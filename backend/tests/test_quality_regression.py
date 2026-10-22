"""
BulletBoost Quality Regression Tests (Tests A through J)
Audits the complete enhancement pipeline, deterministic validator, corrective retry behavior,
supporting-fact scoping, grammar verification, and ML classifier integration.
"""

import json
import pytest
import httpx
from unittest.mock import patch, MagicMock
from typing import List, Dict, Any

from backend.app.config import settings
from backend.app.models import (
    SelectedBullet,
    EnhanceBulletsRequest,
    EnhancedBulletResponse,
    BulletClassificationInput,
    OllamaStatusResponse,
)
from backend.app.services.validator import (
    validate_enhanced_bullet,
    extract_relevant_supporting_facts,
    extract_numbers_and_metrics,
    DUPLICATE_VERBS_PATTERN,
    PUNCTUATION_DEFECT_PATTERN,
)
from backend.app.services.ollama_service import (
    generate_conservative_faithful_rewrite,
    enhance_bullets_with_ollama,
)
from backend.app.services.classifier_service import classifier_service


RESNET_ORIGINAL = "Integrated a fine-tuned ResNet50 model through REST APIs to classify images as Real or AI-Generated."
RESNET_HALLUCINATED = (
    "Provisioned integrated a fine-tuned ResNet50 model through REST APIs to classify images "
    "as Real or AI-Generated., improving throughput by 25% and reducing system overhead."
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


def mock_ready_ollama_status():
    return OllamaStatusResponse(
        reachable=True,
        configured_model=settings.OLLAMA_MODEL,
        model_installed=True,
        status_message="Ready",
        error_category=None,
        available_models=[settings.OLLAMA_MODEL],
    )


# ── Test A: Repeated metric hallucination ─────────────────────────────────────

def test_a_repeated_metric_hallucination():
    """
    Assert that the system does not append 'improving throughput by 25% and reducing
    system overhead' unless the relevant evidence explicitly supports both claims.
    """
    bullets = [
        SelectedBullet(
            id="bullet-resnet",
            text=RESNET_ORIGINAL,
            section_title="Projects",
            section_type="projects",
        ),
        SelectedBullet(
            id="bullet-react",
            text="Developed reusable UI components in React and TypeScript.",
            section_title="Experience",
            section_type="experience",
        ),
    ]

    # Generate conservative rewrites directly
    for b in bullets:
        rewrite = generate_conservative_faithful_rewrite(b.text)
        assert "improving throughput by 25%" not in rewrite.lower()
        assert "system overhead" not in rewrite.lower()
        assert "25%" not in rewrite


# ── Test B: Invalid generated output ──────────────────────────────────────────

@pytest.mark.anyio
async def test_b_invalid_generated_output():
    """
    Mock an Ollama response containing:
    'Provisioned integrated ... improving throughput by 25% and reducing system overhead.'
    Verify validator rejects candidate, triggers corrective retry, and never approves it.
    """
    val = validate_enhanced_bullet(
        original_text=RESNET_ORIGINAL,
        improved_text=RESNET_HALLUCINATED,
        supporting_facts="",
    )

    # 1. Validator must reject this output
    assert not val.is_valid
    assert len(val.rejection_reasons) > 0
    assert any("25%" in r or "overhead" in r or "throughput" in r for r in val.rejection_reasons)
    assert any("Provisioned integrated" in g or "Duplicate" in g for g in val.grammar_errors)

    # 2. Mock Ollama service returning invalid draft first, then clean rewrite on retry
    clean_rewrite = "Integrated a fine-tuned ResNet50 model with REST APIs to classify real and AI-generated images."

    resp1 = httpx.Response(
        200,
        json={
            "message": {
                "content": json.dumps({
                    "results": [
                        {
                            "id": "bullet-resnet",
                            "improved": RESNET_HALLUCINATED,
                            "explanation": "Added metrics",
                        }
                    ]
                })
            }
        },
        request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
    )
    resp2 = httpx.Response(
        200,
        json={
            "message": {
                "content": json.dumps({
                    "results": [
                        {
                            "id": "bullet-resnet",
                            "improved": clean_rewrite,
                            "explanation": "Cleaned grammar and preserved facts",
                        }
                    ]
                })
            }
        },
        request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama_status()):
        with patch("httpx.AsyncClient.post", side_effect=[resp1, resp2]):
            req = EnhanceBulletsRequest(
                bullets=[
                    SelectedBullet(
                        id="bullet-resnet",
                        text=RESNET_ORIGINAL,
                        section_title="Projects",
                        section_type="projects",
                    )
                ],
                target_role="Machine Learning Engineer",
                writing_style="technical",
            )
            response = await enhance_bullets_with_ollama(req)

            assert len(response.bullets) == 1
            res = response.bullets[0]
            # Must never return the hallucinated suggestion as approved recommendation
            assert "improving throughput by 25%" not in res.improved
            assert "Provisioned integrated" not in res.improved
            assert res.improved == clean_rewrite


# ── Test C: Corrective retry fails ───────────────────────────────────────────

@pytest.mark.anyio
async def test_c_corrective_retry_fails():
    """
    Return another hallucinated suggestion on retry.
    Verify that application presents a conservative source-faithful fallback.
    The invalid suggestion must not be displayed as a clean result.
    """
    second_hallucination = (
        "Engineered ResNet50 REST API system, achieving 40% latency reduction across 100k users."
    )

    resp1 = httpx.Response(
        200,
        json={
            "message": {
                "content": json.dumps({
                    "results": [
                        {
                            "id": "bullet-resnet",
                            "improved": RESNET_HALLUCINATED,
                            "explanation": "Added metrics",
                        }
                    ]
                })
            }
        },
        request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
    )
    resp2 = httpx.Response(
        200,
        json={
            "message": {
                "content": json.dumps({
                    "results": [
                        {
                            "id": "bullet-resnet",
                            "improved": second_hallucination,
                            "explanation": "Added metrics again",
                        }
                    ]
                })
            }
        },
        request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama_status()):
        with patch("httpx.AsyncClient.post", side_effect=[resp1, resp2]):
            req = EnhanceBulletsRequest(
                bullets=[
                    SelectedBullet(
                        id="bullet-resnet",
                        text=RESNET_ORIGINAL,
                        section_title="Projects",
                        section_type="projects",
                    )
                ],
                target_role="Machine Learning Engineer",
                writing_style="technical",
            )
            response = await enhance_bullets_with_ollama(req)

            assert len(response.bullets) == 1
            res = response.bullets[0]
            # The invalid second hallucination must be withheld, producing an honest review_needed status
            assert res.status == "review_needed"
            assert res.improved is None
            assert res.original == RESNET_ORIGINAL
            assert res.decision_reason == "validation_failed"
            assert "Unable to produce a safe improvement" in res.explanation


# ── Test D: Correct rewrite without invented metrics ──────────────────────────

def test_d_correct_rewrite_without_invented_metrics():
    """
    Input the ResNet50 bullet.
    Verify that the resulting suggestion is grammatical and preserves original facts
    without introducing throughput or overhead claims.
    """
    rewrite = generate_conservative_faithful_rewrite(RESNET_ORIGINAL, target_role="ML Engineer")

    # Grammar check
    assert not DUPLICATE_VERBS_PATTERN.search(rewrite)
    assert not PUNCTUATION_DEFECT_PATTERN.search(rewrite)
    assert not rewrite.endswith(".,")

    # Meaning preservation
    assert "resnet50" in rewrite.lower()
    assert "rest api" in rewrite.lower()
    assert "classify" in rewrite.lower() or "classification" in rewrite.lower()

    # Absence of hallucinated metrics
    assert "25%" not in rewrite
    assert "throughput" not in rewrite.lower()
    assert "overhead" not in rewrite.lower()


# ── Test E: Supporting facts must be relevant ─────────────────────────────────

def test_e_supporting_facts_relevance():
    """
    Provide a metric for one project (e.g. Celery and Redis) and an unrelated bullet
    for another project (ResNet50).
    Verify that the metric does not leak into the unrelated suggestion.
    """
    shared_facts = "Processed 2 million records daily using Celery and Redis."

    # Scoper must NOT assign Celery/Redis facts to ResNet50
    relevant_for_resnet = extract_relevant_supporting_facts(RESNET_ORIGINAL, shared_facts)
    assert relevant_for_resnet == ""

    # If an LLM tried to inject the 2 million records metric into ResNet50, validator flags it
    leaked_improvement = (
        "Integrated a fine-tuned ResNet50 model through REST APIs to classify images, "
        "processing 2 million records daily using Redis."
    )
    val = validate_enhanced_bullet(
        original_text=RESNET_ORIGINAL,
        improved_text=leaked_improvement,
        supporting_facts=shared_facts,
    )
    assert not val.is_valid
    assert any("2" in w.message or "redis" in w.message.lower() for w in val.warnings)


# ── Test F: No boilerplate repetition ────────────────────────────────────────

def test_f_no_boilerplate_repetition():
    """
    Process several unrelated bullets. Assert that the application does not
    automatically append a shared stock impact phrase to every bullet.
    """
    bullets = [
        "Built automated end-to-end integration test suite using Cypress.",
        "Refactored relational schema migrations using Flyway and PostgreSQL.",
        "Created real-time monitoring alerts in Grafana for microservice uptime.",
    ]

    rewrites = [generate_conservative_faithful_rewrite(b) for b in bullets]

    # Ensure no shared stock ending is copied across all results
    stock_phrases = [
        "improving throughput by 25%",
        "reducing system overhead",
        "driving operational impact",
        "increasing overall efficiency",
    ]
    for stock in stock_phrases:
        count = sum(1 for r in rewrites if stock in r.lower())
        assert count == 0, f"Stock phrase '{stock}' was appended to bullets!"


# ── Test G: Genuine supported metrics ────────────────────────────────────────

def test_g_genuine_supported_metrics():
    """
    If a user's original bullet says 'Reduced inference latency by 20%,'
    verify that the validator does not automatically strip or flag the supported metric.
    """
    original = "Optimized ResNet50 model, reducing inference latency by 20% on embedded GPU devices."
    improved = "Optimized fine-tuned ResNet50 computer vision model on embedded GPUs, reducing inference latency by 20%."

    val = validate_enhanced_bullet(
        original_text=original,
        improved_text=improved,
        supporting_facts="",
    )

    unverified_metrics = [w for w in val.warnings if w.type == "unverified-metric"]
    assert len(unverified_metrics) == 0
    assert val.is_valid


# ── Test H: Malformed grammar ────────────────────────────────────────────────

def test_h_malformed_grammar():
    """
    Return text containing duplicated action verbs and punctuation fragments.
    Ensure the output is caught and rejected by validator.
    """
    malformed = "Provisioned integrated a fine-tuned ResNet50 model through REST APIs., improving throughput by 25%."

    val = validate_enhanced_bullet(
        original_text=RESNET_ORIGINAL,
        improved_text=malformed,
    )

    assert not val.is_valid
    assert len(val.grammar_errors) > 0
    assert any("Provisioned integrated" in g or "Duplicate" in g for g in val.grammar_errors)
    assert any("punctuation" in g.lower() or "defect" in g.lower() for g in val.grammar_errors)


# ── Test I: Classification integration ───────────────────────────────────────

def test_i_classification_integration():
    """
    Return an invalid proposal that the ML classifier might label Strong.
    Verify that validation flags the candidate and prevents an unverified quality uplift.
    """
    # 1. Check ML classification
    predictions = classifier_service.classify_bullets(
        [BulletClassificationInput(id="test_1", text=RESNET_HALLUCINATED)]
    )
    # ML model may score Strong due to "improving", "25%", and verbs
    # But validation MUST flag it as unverified
    val = validate_enhanced_bullet(
        original_text=RESNET_ORIGINAL,
        improved_text=RESNET_HALLUCINATED,
    )

    assert not val.is_valid
    # The proposal has unverified claims, so it must not be endorsed without warning
    assert len(val.warnings) > 0
    assert any(w.type == "unverified-metric" for w in val.warnings)


# ── Test J: Review-state preservation ────────────────────────────────────────

@pytest.mark.anyio
async def test_j_review_state_preservation():
    """
    Verify that retries and validation failures preserve 1-to-1 bullet IDs,
    original texts, and sequential structure.
    """
    input_bullets = [
        SelectedBullet(
            id="proj_bullet_1",
            text=RESNET_ORIGINAL,
            section_title="Projects",
            section_type="projects",
        ),
        SelectedBullet(
            id="proj_bullet_2",
            text="Developed authentication microservice in Node.js and JWT.",
            section_title="Experience",
            section_type="experience",
        ),
    ]

    req = EnhanceBulletsRequest(
        bullets=input_bullets,
        target_role="Full Stack Engineer",
        writing_style="technical",
    )

    resp = httpx.Response(
        200,
        json={
            "message": {
                "content": json.dumps({
                    "results": [
                        {
                            "id": "proj_bullet_1",
                            "improved": "Integrated ResNet50 model with REST APIs for image classification.",
                            "explanation": "Enhanced phrasing",
                        },
                        {
                            "id": "proj_bullet_2",
                            "improved": "Implemented secure JWT authentication microservice using Node.js.",
                            "explanation": "Stronger verbs",
                        },
                    ]
                })
            }
        },
        request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
    )

    with patch("backend.app.services.ollama_service.check_ollama_status", return_value=mock_ready_ollama_status()):
        with patch("httpx.AsyncClient.post", return_value=resp):
            response = await enhance_bullets_with_ollama(req)

            assert len(response.bullets) == 2
            # Bullet IDs must strictly match input bullet IDs
            assert response.bullets[0].id == "enh_proj_bullet_1"
            assert response.bullets[1].id == "enh_proj_bullet_2"
            assert response.bullets[0].original_bullet_id == "proj_bullet_1"
            assert response.bullets[1].original_bullet_id == "proj_bullet_2"
            # Original text preserved
            assert response.bullets[0].original == RESNET_ORIGINAL
            assert response.bullets[1].original == "Developed authentication microservice in Node.js and JWT."
