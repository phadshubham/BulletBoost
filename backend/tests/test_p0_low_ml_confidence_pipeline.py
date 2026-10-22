import json
import pytest
import httpx
from unittest.mock import patch
from backend.app.models import (
    EnhanceBulletsRequest,
    SelectedBullet,
    OllamaStatusResponse,
)
from backend.app.services.ollama_service import (
    enhance_bullets_with_ollama,
)
from backend.app.services.classifier_service import (
    classifier_service,
)
from backend.app.services.validator import (
    validate_enhanced_bullet,
    is_candidate_no_op,
)

# The 7 regression bullets from the live report
BULLETS_7 = [
    "Developed an AI-powered sales forecasting dashboard combining Prophet and Auto-ARIMA for multi-model forecasting.",
    "Built model evaluation using MAE, RMSE and MAPE and generated KPI insights including growth trends.",
    "Integrated LLaMA3 through Ollama and LangChain to generate contextual business insights from forecast data.",
    "Implemented Grad-CAM explainability to generate heatmaps showing image regions influencing model decisions.",
    "Built real-time prediction APIs using FastAPI with a React frontend for image upload, classification and visualization.",
    "Achieved 97.59% validation accuracy across 22,000 validation samples.",
    "Built model evaluation workflows using MAE, RMSE and MAPE to compare forecasting performance.",
]


def mock_ready_ollama():
    return OllamaStatusResponse(
        reachable=True,
        configured_model="llama3.2:3b",
        model_installed=True,
        status_message="Ollama service is reachable and configured model is installed.",
        available_models=["llama3.2:3b"],
    )


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_low_confidence_does_not_suppress_enhancement():
    """
    Requirement 1 & 2: Low classifier confidence (e.g. 0.39 Adequate) does NOT prevent
    Ollama enhancement from being attempted, and Adequate/Strong original classifications
    can still receive meaningful suggestions.
    """
    orig_text = BULLETS_7[1]  # "Built model evaluation using MAE, RMSE and MAPE and generated KPI insights including growth trends."
    mock_llm_json = json.dumps({
        "results": [{
            "id": "b2",
            "improved": "Evaluated forecasting models using MAE, RMSE, and MAPE, and generated KPI insights to identify growth trends.",
            "explanation": "Refined phrasing to active voice and clarified purpose.",
            "alternatives": [],
            "is_already_clear": False,
        }]
    })
    mock_resp = httpx.Response(
        200,
        json={"message": {"content": mock_llm_json}},
        request=httpx.Request("POST", "http://localhost:11434/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama()):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            req = EnhanceBulletsRequest(
                bullets=[SelectedBullet(id="b2", text=orig_text, section_title="Projects", section_type="projects")],
                target_role="Machine Learning Engineer",
                writing_style="technical",
            )
            resp = await enhance_bullets_with_ollama(req)

            assert len(resp.bullets) == 1
            res = resp.bullets[0]
            assert res.id == "enh_b2"
            assert res.original_bullet_id == "b2"
            assert res.status == "pending"
            assert res.improved is not None
            assert "Evaluated forecasting models" in res.improved
            assert res.decision_reason == "meaningful_suggestion"


@pytest.mark.anyio
async def test_already_clear_bullet_receives_no_suggestion_legitimately():
    """
    Requirement 3 & 8: A strong, already well-written metric bullet (e.g. b6) legitimately
    receives no_suggestion when model flags is_already_clear: true, with decision_reason="original_already_clear".
    """
    orig_text = BULLETS_7[5]  # "Achieved 97.59% validation accuracy across 22,000 validation samples."
    mock_llm_json = json.dumps({
        "results": [{
            "id": "b6",
            "improved": "Achieved 97.59% validation accuracy across 22,000 validation samples.",
            "explanation": "The original bullet is already concise, metric-backed, and clear.",
            "alternatives": [],
            "is_already_clear": True,
        }]
    })
    mock_resp = httpx.Response(
        200,
        json={"message": {"content": mock_llm_json}},
        request=httpx.Request("POST", "http://localhost:11434/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama()):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            req = EnhanceBulletsRequest(
                bullets=[SelectedBullet(id="b6", text=orig_text, section_title="Projects", section_type="projects")],
                target_role="Machine Learning Engineer",
                writing_style="technical",
            )
            resp = await enhance_bullets_with_ollama(req)

            assert len(resp.bullets) == 1
            res = resp.bullets[0]
            assert res.id == "enh_b6"
            assert res.original_bullet_id == "b6"
            assert res.status == "no_suggestion"
            assert res.improved is None
            assert res.decision_reason == "original_already_clear"
            assert "clear" in res.explanation.lower()


@pytest.mark.anyio
async def test_identical_text_returns_no_suggestion():
    """
    Requirement 4: When candidate is identical to original, return no_suggestion with decision_reason="unchanged_candidate".
    """
    orig_text = BULLETS_7[0]
    mock_llm_json = json.dumps({
        "results": [{
            "id": "b1",
            "improved": orig_text,
            "explanation": "No changes made.",
            "alternatives": [],
            "is_already_clear": False,
        }]
    })
    mock_resp = httpx.Response(
        200,
        json={"message": {"content": mock_llm_json}},
        request=httpx.Request("POST", "http://localhost:11434/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama()):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            req = EnhanceBulletsRequest(
                bullets=[SelectedBullet(id="b1", text=orig_text, section_title="Projects", section_type="projects")],
                target_role="Machine Learning Engineer",
                writing_style="technical",
            )
            resp = await enhance_bullets_with_ollama(req)

            assert len(resp.bullets) == 1
            res = resp.bullets[0]
            assert res.status == "no_suggestion"
            assert res.improved is None
            assert res.decision_reason == "unchanged_candidate"


@pytest.mark.anyio
async def test_unsupported_metrics_rejected_and_produces_review_needed():
    """
    Requirement 6, 7 & 12: Unsupported metrics are rejected, and a failed retry does NOT masquerade
    as 'original_already_clear'. It must yield status='review_needed' with decision_reason='validation_failed'.
    """
    orig_text = BULLETS_7[3]  # Grad-CAM bullet
    # Attempt 1: hallucinated 45% accuracy
    mock_llm_json_1 = json.dumps({
        "results": [{
            "id": "b4",
            "improved": "Implemented Grad-CAM explainability boosting model interpretability by 45% across heatmaps.",
            "explanation": "Added 45% metric.",
            "alternatives": [],
        }]
    })
    # Attempt 2 (retry): hallucinated 80% reduction
    mock_llm_json_2 = json.dumps({
        "results": [{
            "id": "b4",
            "improved": "Implemented Grad-CAM explainability achieving 80% faster defect localization.",
            "explanation": "Added 80% speedup.",
            "alternatives": [],
        }]
    })
    resp1 = httpx.Response(200, json={"message": {"content": mock_llm_json_1}}, request=httpx.Request("POST", "http://localhost:11434/api/chat"))
    resp2 = httpx.Response(200, json={"message": {"content": mock_llm_json_2}}, request=httpx.Request("POST", "http://localhost:11434/api/chat"))

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama()):
        with patch("httpx.AsyncClient.post", side_effect=[resp1, resp2]):
            req = EnhanceBulletsRequest(
                bullets=[SelectedBullet(id="b4", text=orig_text, section_title="Projects", section_type="projects")],
                target_role="Machine Learning Engineer",
                writing_style="technical",
            )
            resp = await enhance_bullets_with_ollama(req)

            assert len(resp.bullets) == 1
            res = resp.bullets[0]
            assert res.status == "review_needed"
            assert res.improved is None
            assert res.decision_reason == "validation_failed"
            assert "Unable to produce a safe improvement" in res.explanation


@pytest.mark.anyio
async def test_all_seven_bullets_processed_independently_with_stable_ids():
    """
    Requirement 9 & 10: All 7 bullets can be processed independently without facts or suggestions leaking,
    and each returned result maps to the correct original bullet ID.
    """
    results = []
    for idx, bullet in enumerate(BULLETS_7):
        if idx == 5:
            results.append({
                "id": f"proj_{idx}",
                "improved": bullet,
                "explanation": "Already concise.",
                "is_already_clear": True,
                "alternatives": [],
            })
        else:
            results.append({
                "id": f"proj_{idx}",
                "improved": f"Engineered verified implementation of {bullet[:25]} without inventing metrics.",
                "explanation": "Sharpened phrasing.",
                "is_already_clear": False,
                "alternatives": [],
            })
    mock_resp = httpx.Response(
        200,
        json={"message": {"content": json.dumps({"results": results})}},
        request=httpx.Request("POST", "http://localhost:11434/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama()):
        with patch("httpx.AsyncClient.post", return_value=mock_resp):
            req = EnhanceBulletsRequest(
                bullets=[
                    SelectedBullet(id=f"proj_{idx}", text=b, section_title="Projects", section_type="projects")
                    for idx, b in enumerate(BULLETS_7)
                ],
                target_role="Machine Learning Engineer",
                writing_style="technical",
            )
            resp = await enhance_bullets_with_ollama(req)

            assert len(resp.bullets) == 7
            for idx, res in enumerate(resp.bullets):
                assert res.id == f"enh_proj_{idx}"
                assert res.original_bullet_id == f"proj_{idx}"
                assert res.original == BULLETS_7[idx]
                if idx == 5:
                    assert res.status == "no_suggestion"
                    assert res.decision_reason == "original_already_clear"
                else:
                    assert res.status == "pending"
                    assert res.decision_reason == "meaningful_suggestion"
