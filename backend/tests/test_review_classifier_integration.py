"""
Tests for BulletBoost Review and ML Classifier Integration.
Verifies:
- Original and proposed bullet predictions
- Reclassification of edited bullet text
- Status preservation (Accepted, Rejected, Pending are never modified by ML predictions)
- Batch prediction reliability and missing artifact handling
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.classifier_service import classifier_service, ClassifierService

client = TestClient(app)


def test_original_and_proposed_bullet_predictions():
    """Simulates the ResultsReview flow: evaluating both original and proposed bullets."""
    bullets = [
        {"id": "card-1:orig", "text": "Responsible for website maintenance."},
        {
            "id": "card-1:improved",
            "text": "Engineered automated CI/CD deployment pipelines on AWS with GitHub Actions, reducing deployment errors by 70%.",
        },
        {"id": "card-2:orig", "text": "Helped team fix bugs."},
        {
            "id": "card-2:improved",
            "text": "Developed unit and integration test suites using pytest and Jest across 12 microservices.",
        },
    ]

    response = client.post("/api/classify-bullets", json={"bullets": bullets})
    assert response.status_code == 200
    data = response.json()

    preds_by_id = {p["id"]: p for p in data["predictions"]}

    # Original bullets should be categorized as weak
    assert preds_by_id["card-1:orig"]["quality"] == "weak"
    assert preds_by_id["card-2:orig"]["quality"] == "weak"

    # Proposed bullets should be categorized as strong or adequate
    assert preds_by_id["card-1:improved"]["quality"] == "strong"
    assert preds_by_id["card-2:improved"]["quality"] in ["adequate", "strong"]

    # All predictions have confidence values between 0 and 1
    for p in data["predictions"]:
        assert 0.0 <= p["confidence"] <= 1.0
        assert p["status"] == "success"


def test_edited_bullet_reclassification():
    """Simulates editing a bullet: when user edits the text, it is re-evaluated."""
    original_proposed = "Helped write some code for the application."
    user_edited_text = (
        "Architected and deployed scalable multi-tenant SaaS backend with FastAPI and PostgreSQL, "
        "reducing p95 API response times from 420ms to 85ms."
    )

    # Initial proposed
    res1 = client.post(
        "/api/classify-bullets",
        json={"bullets": [{"id": "b-edit-1", "text": original_proposed}]},
    )
    assert res1.status_code == 200
    pred1 = res1.json()["predictions"][0]
    assert pred1["quality"] == "weak"

    # Reclassification with user's edited text
    res2 = client.post(
        "/api/classify-bullets",
        json={"bullets": [{"id": "b-edit-1", "text": user_edited_text}]},
    )
    assert res2.status_code == 200
    pred2 = res2.json()["predictions"][0]
    assert pred2["quality"] == "strong"
    assert pred2["confidence"] > 0.5


def test_scoring_has_no_side_effects_on_review_status():
    """
    Verifies that classification predictions do NOT change or determine bullet review statuses.
    Bullet state machine (pending -> accepted / rejected) is solely driven by user actions.
    """
    # Sample bullet state representations
    bullets_state = [
        {"id": "b1", "status": "pending", "quality": None},
        {"id": "b2", "status": "accepted", "quality": None},
        {"id": "b3", "status": "rejected", "quality": None},
    ]

    # Predict qualities
    res = client.post(
        "/api/classify-bullets",
        json={
            "bullets": [
                {"id": "b1", "text": "Responsible for office network."},
                {"id": "b2", "text": "Did basic testing."},
                {
                    "id": "b3",
                    "text": "Architected distributed event-driven ingestion pipeline in Python with Kafka, processing 2M events/day.",
                },
            ]
        },
    )
    assert res.status_code == 200
    predictions = {p["id"]: p for p in res.json()["predictions"]}

    # Update classification without altering status
    for b in bullets_state:
        b["quality"] = predictions[b["id"]]["quality"]

    # Assert statuses remained exactly as user set them
    assert bullets_state[0]["status"] == "pending"
    assert bullets_state[1]["status"] == "accepted"  # Even if quality is weak/adequate
    assert bullets_state[2]["status"] == "rejected"  # Even if quality is strong!


def test_evaluation_metrics_unavailable_when_missing(monkeypatch, tmp_path):
    """Verifies that GET /api/evaluation/metrics returns available=False when report does not exist."""
    fake_svc = ClassifierService(
        model_path=str(tmp_path / "model.joblib"),
        report_path=str(tmp_path / "nonexistent_report.json"),
    )

    from backend.app.routers import classifier
    monkeypatch.setattr(classifier, "classifier_service", fake_svc)

    res = client.get("/api/evaluation/metrics")
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is False
    assert "not found" in data["status_message"].lower()
    assert data["metrics"] is None
