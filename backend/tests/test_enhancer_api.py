import json
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import httpx

from backend.app.main import app
from backend.app.config import settings
from backend.app.models import OllamaStatusResponse


@pytest.fixture
def sample_enhancement_payload():
    return {
        "bullets": [
            {
                "id": "b_1",
                "text": "Worked on the company search engine performance.",
                "section_title": "Work Experience",
                "section_type": "experience",
            },
            {
                "id": "b_2",
                "text": "Built customer-facing web dashboard using React.",
                "section_title": "Work Experience",
                "section_type": "experience",
            },
        ],
        "target_role": "Senior Full Stack Engineer",
        "job_description": "Looking for React and Python backend engineers.",
        "writing_style": "achievement",
        "supporting_facts": "",
    }


def test_ollama_status_endpoint(client: TestClient):
    """Verify /api/ollama/status returns valid model and connection diagnostic."""
    response = client.get("/api/ollama/status")
    assert response.status_code == 200
    data = response.json()
    assert "reachable" in data
    assert "configured_model" in data
    assert data["configured_model"] == settings.OLLAMA_MODEL
    assert "model_installed" in data
    assert "status_message" in data


def test_1_successful_enhancement_with_mocked_ollama(client: TestClient, sample_enhancement_payload):
    """Scenario 1 & 5: Successful enhancement with mocked Ollama response and structured validation."""
    mock_ollama_output = {
        "message": {
            "content": json.dumps({
                "results": [
                    {
                        "bullet_id": "b_1",
                        "improved_text": "Optimized core search engine query algorithms, enhancing retrieval speed.",
                        "alternative_texts": ["Refactored search architecture for higher throughput."],
                        "change_explanation": "Replaced generic 'worked on' with 'optimized core search engine query algorithms'.",
                    },
                    {
                        "bullet_id": "b_2",
                        "improved_text": "Developed customer-facing analytics dashboard in React, delivering responsive UI components.",
                        "alternative_texts": [],
                        "change_explanation": "Emphasized delivered deliverables and technical implementation.",
                    },
                ]
            })
        }
    }

    with patch("backend.app.services.ollama_service.check_ollama_status") as mock_status:
        mock_status.return_value = OllamaStatusResponse(
            reachable=True,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=True,
            status_message="Ready",
            error_category=None,
            available_models=[settings.OLLAMA_MODEL],
        )
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_post.return_value = httpx.Response(
                200,
                json=mock_ollama_output,
                request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
            )

            res = client.post("/api/enhance-bullets", json=sample_enhancement_payload)
            assert res.status_code == 200
            data = res.json()

            # Scenario 5: Structured response validation
            assert data["model_used"] == settings.OLLAMA_MODEL
            assert len(data["bullets"]) == 2
            assert data["enhancement_time_ms"] > 0

            # Scenario 15: Multiple bullets mapped back to their original IDs
            b1 = next(b for b in data["bullets"] if b["original_bullet_id"] == "b_1")
            b2 = next(b for b in data["bullets"] if b["original_bullet_id"] == "b_2")

            assert b1["id"] == "enh_b_1"
            assert "Optimized core search engine" in b1["improved"]
            # Scenario 17: Original text is preserved, not overwritten
            assert b1["original"] == sample_enhancement_payload["bullets"][0]["text"]
            assert b1["status"] == "pending"
            assert b1["quality"] is None  # Truthful: ML model pending

            assert b2["id"] == "enh_b_2"
            assert "Developed customer-facing analytics dashboard" in b2["improved"]
            assert b2["original"] == sample_enhancement_payload["bullets"][1]["text"]


def test_6_malformed_json_triggers_retry_and_handles_failure(client: TestClient, sample_enhancement_payload):
    """Scenario 6: Model returns non-JSON or malformed output; endpoint handles failure without crashing."""
    mock_bad_output = {
        "message": {
            "content": "I am an AI and here is your improved bullet: Bullet 1 is great."
        }
    }

    with patch("backend.app.services.ollama_service.check_ollama_status") as mock_status:
        mock_status.return_value = OllamaStatusResponse(
            reachable=True,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=True,
            status_message="Ready",
            error_category=None,
        )
        with patch("httpx.AsyncClient.post") as mock_post:
            # Both primary attempt and retry return non-JSON
            mock_post.return_value = httpx.Response(
                200,
                json=mock_bad_output,
                request=httpx.Request("POST", f"{settings.OLLAMA_BASE_URL}/api/chat"),
            )

            res = client.post("/api/enhance-bullets", json=sample_enhancement_payload)
            assert res.status_code == 502
            assert "valid JSON" in res.json()["detail"]


def test_7_ollama_unavailable(client: TestClient, sample_enhancement_payload):
    """Scenario 7 & 14: Ollama service is stopped; returns 503 error, never silent demo fallback."""
    with patch("backend.app.services.ollama_service.check_ollama_status") as mock_status:
        mock_status.return_value = OllamaStatusResponse(
            reachable=False,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=False,
            status_message="Ollama is not running",
            error_category="service_unreachable",
        )

        res = client.post("/api/enhance-bullets", json=sample_enhancement_payload)
        assert res.status_code == 503
        assert "not running" in res.json()["detail"].lower()
        # Ensure it does NOT return 200 with fake demo content
        assert res.status_code != 200


def test_8_configured_model_missing(client: TestClient, sample_enhancement_payload):
    """Scenario 8: Model is missing from local Ollama; returns 404 with instructions."""
    with patch("backend.app.services.ollama_service.check_ollama_status") as mock_status:
        mock_status.return_value = OllamaStatusResponse(
            reachable=True,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=False,
            status_message="Model missing",
            error_category="model_missing",
        )

        res = client.post("/api/enhance-bullets", json=sample_enhancement_payload)
        assert res.status_code == 404
        assert "ollama pull" in res.json()["detail"]


def test_9_request_timeout(client: TestClient, sample_enhancement_payload):
    """Scenario 9: Ollama inference times out; returns 504 Gateway Timeout."""
    with patch("backend.app.services.ollama_service.check_ollama_status") as mock_status:
        mock_status.return_value = OllamaStatusResponse(
            reachable=True,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=True,
            status_message="Ready",
            error_category=None,
        )
        with patch("httpx.AsyncClient.post", side_effect=httpx.TimeoutException("Read timeout")):
            res = client.post("/api/enhance-bullets", json=sample_enhancement_payload)
            assert res.status_code == 504
            assert "timed out" in res.json()["detail"].lower()


def test_empty_bullets_rejected(client: TestClient):
    """Empty bullets list is rejected with 400 Bad Request."""
    res = client.post(
        "/api/enhance-bullets",
        json={"bullets": [], "target_role": "Developer"},
    )
    assert res.status_code in (400, 422)


def test_blank_target_role_rejected(client: TestClient):
    """Blank target role is rejected with 400 Bad Request."""
    res = client.post(
        "/api/enhance-bullets",
        json={
            "bullets": [{"id": "b1", "text": "test", "section_title": "Exp"}],
            "target_role": "   ",
        },
    )
    assert res.status_code in (400, 422)
