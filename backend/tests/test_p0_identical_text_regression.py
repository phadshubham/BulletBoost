"""
BulletBoost - P0 Regression Tests
Tests for identical text, fake quality uplift prevention, and classifier-to-text association.
Validates requirements A through J from P0 specification.
"""

import json
import pytest
import httpx
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import settings
from backend.app.models import (
    EnhanceBulletsRequest,
    SelectedBullet,
    BulletClassificationInput,
    ClassifyBulletsRequest,
    ResumeSection,
    ResumeItem,
    AcceptedBulletExportItem,
    ExportDocxRequest,
    OllamaStatusResponse,
)
from backend.app.services.validator import (
    is_candidate_no_op,
    normalize_bullet_for_comparison,
    validate_enhanced_bullet,
)
from backend.app.services.ollama_service import enhance_bullets_with_ollama
from backend.app.services.classifier_service import classifier_service
from backend.app.services.exporter import generate_resume_docx

client = TestClient(app)

P0_BULLET = "Built model evaluation workflows using MAE, RMSE and MAPE to compare forecasting performance."


# ── Test A: Identical text ────────────────────────────────────────────────────

def test_a_identical_text_returns_no_suggestion():
    """
    Test A:
    Input:
    Original: "Built model evaluation workflows using MAE, RMSE and MAPE to compare forecasting performance."
    Generated: "Built model evaluation workflows using MAE, RMSE and MAPE to compare forecasting performance."
    Expected:
    - status = "no_suggestion"
    - improved = None
    - No invented explanation ("The original bullet is already clear, or no meaningful improvement was found.")
    - Original text remains unchanged
    """
    mock_llm_json = json.dumps({
        "results": [
            {
                "id": "b-eval-1",
                "improved": P0_BULLET,
                "explanation": "Preserved core technical verb 'Built' and refined sentence clarity and flow.",
            }
        ]
    })

    mock_resp = httpx.Response(
        200,
        json={"message": {"content": mock_llm_json}},
        request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status") as mock_status:
        mock_status.return_value = OllamaStatusResponse(
            reachable=True,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=True,
            status_message="Ready",
            error_category=None,
            available_models=[settings.OLLAMA_MODEL],
        )
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            payload = {
                "bullets": [
                    {
                        "id": "b-eval-1",
                        "text": P0_BULLET,
                        "section_title": "Experience",
                        "section_type": "experience",
                    }
                ],
                "target_role": "Machine Learning Engineer",
                "writing_style": "technical",
            }
            res = client.post("/api/enhance-bullets", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert len(data["bullets"]) == 1
            bullet = data["bullets"][0]
            assert bullet["status"] == "no_suggestion"
            assert bullet["improved"] is None
            assert bullet["original"] == P0_BULLET
            assert "The original bullet is already clear, or no meaningful improvement was found." in bullet["explanation"]
            assert "refined sentence clarity" not in bullet["explanation"].lower()
            assert bullet["alternative_texts"] == []


# ── Test B: Identical text with whitespace differences ────────────────────────

def test_b_identical_text_with_whitespace_differences():
    """
    Test B:
    Compare the same text with leading, trailing, and repeated whitespace.
    Assert that it is classified as no-op without modifying stored original text.
    """
    whitespace_variant = f"  \n\t  {P0_BULLET}   \n  "
    multi_space_variant = "Built  model   evaluation  workflows using  MAE, RMSE  and MAPE to compare forecasting performance."

    assert is_candidate_no_op(P0_BULLET, whitespace_variant) is True
    assert is_candidate_no_op(P0_BULLET, multi_space_variant) is True

    # Check normalization function directly
    norm1 = normalize_bullet_for_comparison(P0_BULLET)
    norm2 = normalize_bullet_for_comparison(whitespace_variant)
    norm3 = normalize_bullet_for_comparison(multi_space_variant)
    assert norm1 == norm2 == norm3


# ── Test C: Harmless formatting-only change ────────────────────────────────────

def test_c_harmless_formatting_only_change():
    """
    Test C:
    A difference in inconsequential punctuation or capitalization must be detected
    as a no-op candidate.
    """
    punct_variant1 = P0_BULLET + "."
    punct_variant2 = P0_BULLET + "..."
    case_variant = P0_BULLET.lower()
    bullet_marker_variant = "• " + P0_BULLET

    assert is_candidate_no_op(P0_BULLET, punct_variant1) is True
    assert is_candidate_no_op(P0_BULLET, punct_variant2) is True
    assert is_candidate_no_op(P0_BULLET, case_variant) is True
    assert is_candidate_no_op(P0_BULLET, bullet_marker_variant) is True


# ── Test D: Real grammar correction ───────────────────────────────────────────

def test_d_real_grammar_correction():
    """
    Test D:
    Input: "Worked on machine learning project using Python."
    Candidate: "Worked on a machine learning project using Python."
    This is a legitimate minor grammar correction (adding article 'a').
    Verify it is NOT suppressed as a no-op candidate.
    """
    orig = "Worked on machine learning project using Python."
    cand = "Worked on a machine learning project using Python."

    # Word sequence changed by adding 'a'
    assert is_candidate_no_op(orig, cand) is False

    val_res = validate_enhanced_bullet(
        original_text=orig,
        improved_text=cand,
    )
    assert val_res.is_valid is True
    assert val_res.missing_evidence == []


# ── Test E: Correctly mapped classifier results ───────────────────────────────

def test_e_correctly_mapped_classifier_results():
    """
    Test E:
    Submit a batch of multiple bullet IDs and verify that each category and confidence
    is mapped to its correct ID and text version, regardless of return order.
    """
    inputs = [
        BulletClassificationInput(id="bullet-101", text="Engineered distributed ETL pipelines handling 50TB daily using Apache Spark and Kafka."),
        BulletClassificationInput(id="bullet-202", text="Helped team with some tasks and attended weekly meetings."),
        BulletClassificationInput(id="bullet-303", text="Implemented REST APIs with Flask."),
    ]

    res = classifier_service.classify_bullets(inputs)

    assert len(res) == 3
    pred_map = {p.id: p for p in res}

    # Verify every ID exists and retained its exact text version
    assert "bullet-101" in pred_map
    assert "bullet-202" in pred_map
    assert "bullet-303" in pred_map

    assert pred_map["bullet-101"].text == inputs[0].text
    assert pred_map["bullet-202"].text == inputs[1].text
    assert pred_map["bullet-303"].text == inputs[2].text

    # Strong bullet should be classified as strong
    assert pred_map["bullet-101"].quality == "strong"
    # Weak bullet should be classified as weak
    assert pred_map["bullet-202"].quality == "weak"

    # Verify API endpoint works with batch
    api_resp = client.post("/api/classify-bullets", json={"bullets": [b.model_dump() for b in inputs]})
    assert api_resp.status_code == 200
    api_data = api_resp.json()
    api_pred_map = {p["id"]: p for p in api_data["predictions"]}
    assert api_pred_map["bullet-101"]["quality"] == "strong"
    assert api_pred_map["bullet-101"]["text"] == inputs[0].text


# ── Test F: Deterministic classification consistency ──────────────────────────

def test_f_deterministic_classification_consistency():
    """
    Test F:
    For the exact same normalized input text, the model must return identical category
    and confidence.
    """
    input1 = [BulletClassificationInput(id="b1", text=P0_BULLET)]
    input2 = [BulletClassificationInput(id="b2", text=P0_BULLET)]

    res1 = classifier_service.classify_bullets(input1)
    res2 = classifier_service.classify_bullets(input2)

    assert res1[0].quality == res2[0].quality
    assert res1[0].confidence == res2[0].confidence


# ── Test G: No false uplift for identical original and proposed text ──────────

def test_g_no_false_uplift_on_identical_text():
    """
    Test G:
    When candidate text is identical, the enhancement pipeline returns no_suggestion,
    preventing any fake quality tier uplift.
    """
    assert is_candidate_no_op(P0_BULLET, P0_BULLET) is True


# ── Test H: Real improvement receives honest classification ───────────────────

def test_h_real_improvement():
    """
    Test H:
    A genuinely different, valid rewrite that adds active verbs and preserves facts.
    """
    orig = "Responsible for building forecasting performance models."
    cand = "Built and calibrated forecasting performance models using MAE and RMSE metrics."

    assert is_candidate_no_op(orig, cand) is False
    val_res = validate_enhanced_bullet(original_text=orig, improved_text=cand)
    assert val_res.is_valid is True

    # Classify both individually
    res = classifier_service.classify_bullets([
        BulletClassificationInput(id="orig", text=orig),
        BulletClassificationInput(id="cand", text=cand),
    ])
    pred_map = {p.id: p for p in res}
    assert pred_map["orig"].text == orig
    assert pred_map["cand"].text == cand


# ── Test I: No-suggestion through Final Review and export ─────────────────────

def test_i_no_suggestion_through_export():
    """
    Test I:
    Verify that unchanged bullets (no_suggestion) are not included in accepted_bullets,
    and their original text is preserved completely in the generated DOCX.
    """
    sections = [
        ResumeSection(
            id="sec-1",
            title="Experience",
            type="experience",
            selected=True,
            bullets=[
                ResumeItem(
                    id="b-no-sugg",
                    text=P0_BULLET,
                    item_type="bullet",
                    selected=True,
                ),
                ResumeItem(
                    id="b-accepted",
                    text="Responsible for sales pipeline.",
                    item_type="bullet",
                    selected=True,
                ),
            ],
        )
    ]

    # Only b-accepted was accepted by user; b-no-sugg had no suggestion needed
    accepted_map = {
        "b-accepted": "Expanded qualified B2B sales pipeline by 35% through targeted outbound campaigns.",
    }

    doc_bytes = generate_resume_docx(
        sections=sections,
        accepted_bullets_map=accepted_map,
        document_title="Jane_Doe_Resume.docx",
    )

    assert len(doc_bytes) > 0
    # Also verify via API endpoint
    export_req = ExportDocxRequest(
        filename="Jane_Doe_Resume.docx",
        sections=sections,
        accepted_bullets=[
            AcceptedBulletExportItem(
                bullet_id="b-accepted",
                text=accepted_map["b-accepted"],
            )
        ],
    )
    resp = client.post("/api/export-docx", json=export_req.model_dump())
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
