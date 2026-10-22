"""
API Integration tests for the ML Bullet Classifier and Evaluation endpoints.
Covers:
- POST /api/classify-bullets with valid inputs and ID preservation
- Correct bullet ID mapping for batch predictions
- Invalid inference inputs (empty payload, >100 bullets, empty text)
- GET /api/evaluation/metrics
- GET /api/classifier/status
- Model unavailability handling without fake predictions
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.classifier_service import ClassifierService, classifier_service

client = TestClient(app)


def test_classify_bullets_batch_mapping():
    """Verifies that batch predictions maintain exact 1:1 ID mapping in the same order."""
    payload = {
        "bullets": [
            {"id": "id-zeta", "text": "Worked on python code."},
            {"id": "id-alpha", "text": "Implemented user authentication using OAuth2 and JWT in FastAPI."},
            {"id": "id-beta", "text": "Spearheaded zero-downtime database migration for 500GB PostgreSQL database."},
        ]
    }
    response = client.post("/api/classify-bullets", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["model_version"] == "1.0.0"
    assert data["total_classified"] == 3
    assert len(data["predictions"]) == 3

    # Check exact order and IDs
    assert data["predictions"][0]["id"] == "id-zeta"
    assert data["predictions"][0]["quality"] == "weak"
    assert data["predictions"][0]["status"] == "success"

    assert data["predictions"][1]["id"] == "id-alpha"
    assert data["predictions"][1]["quality"] == "adequate"
    assert data["predictions"][1]["status"] == "success"

    assert data["predictions"][2]["id"] == "id-beta"
    assert data["predictions"][2]["quality"] == "strong"
    assert data["predictions"][2]["status"] == "success"


def test_classify_bullets_invalid_inputs():
    """Verifies rejection of empty list and handles blank text properly."""
    # Empty bullets list
    res_empty = client.post("/api/classify-bullets", json={"bullets": []})
    assert res_empty.status_code in (400, 422)

    # Over 100 bullets
    too_many = [{"id": f"b{i}", "text": "Some text"} for i in range(101)]
    res_large = client.post("/api/classify-bullets", json={"bullets": too_many})
    assert res_large.status_code in (400, 422)

    # Blank and whitespace bullet text handled gracefully per-item without failing whole batch
    mixed_payload = {
        "bullets": [
            {"id": "blank-1", "text": "   "},
            {"id": "valid-1", "text": "Developed REST APIs using Python and FastAPI."},
        ]
    }
    res_mixed = client.post("/api/classify-bullets", json=mixed_payload)
    assert res_mixed.status_code == 200
    preds = res_mixed.json()["predictions"]
    assert preds[0]["id"] == "blank-1"
    assert preds[0]["status"] == "invalid_input"
    assert preds[0]["quality"] is None
    assert preds[1]["id"] == "valid-1"
    assert preds[1]["status"] == "success"
    assert preds[1]["quality"] == "adequate"


def test_evaluation_metrics_endpoint():
    """Verifies that GET /api/evaluation/metrics returns actual serialized results."""
    response = client.get("/api/evaluation/metrics")
    assert response.status_code == 200
    data = response.json()

    assert data["available"] is True
    assert data["model_name"] == "bullet_quality_classifier"
    assert data["model_version"] == "1.0.0"
    assert "metrics" in data
    assert "accuracy" in data["metrics"]
    assert data["metrics"]["accuracy"] > 0.5
    assert data["metrics"]["class_labels"] == ["weak", "adequate", "strong"]
    assert len(data["metrics"]["confusion_matrix"]) == 3


def test_classifier_status_endpoint():
    """Verifies GET /api/classifier/status returns accurate environment metadata."""
    response = client.get("/api/classifier/status")
    assert response.status_code == 200
    data = response.json()

    assert data["model_loaded"] is True
    assert data["model_version"] == "1.0.0"
    assert data["dataset_available"] is True
    assert data["evaluation_report_available"] is True
    assert data["last_trained"] is not None


def test_no_fake_predictions_when_model_missing(monkeypatch, tmp_path):
    """Verifies that if the model file is not found, no fake predictions are returned."""
    # Temporarily point classifier_service to an empty temp dir
    fake_svc = ClassifierService(
        model_path=str(tmp_path / "missing.joblib"),
        report_path=str(tmp_path / "missing.json")
    )

    from backend.app.routers import classifier
    monkeypatch.setattr(classifier, "classifier_service", fake_svc)

    res = client.post("/api/classify-bullets", json={
        "bullets": [{"id": "b-test", "text": "Engineered something incredible"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert len(data["predictions"]) == 1
    pred = data["predictions"][0]
    assert pred["id"] == "b-test"
    assert pred["status"] == "model_unavailable"
    assert pred["quality"] is None  # Honest: no fabricated quality
    assert pred["confidence"] is None
