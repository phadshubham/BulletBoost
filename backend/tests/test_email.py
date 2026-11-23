from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_send_resume_invalid_email():
    payload = {
        "recipient_email": "invalid-email-no-at-sign",
        "sections": [
            {
                "id": "s1",
                "title": "Experience",
                "type": "experience",
                "bullets": [{"id": "b1", "text": "Built web app."}]
            }
        ]
    }
    res = client.post("/api/send-resume", json=payload)
    assert res.status_code == 400
    assert "recipient email" in res.json()["detail"].lower()


def test_send_resume_api_key_missing():
    payload = {
        "recipient_email": "recruiter@example.com",
        "target_role": "Full Stack Engineer",
        "sections": [
            {
                "id": "s1",
                "title": "Experience",
                "type": "experience",
                "bullets": [{"id": "b1", "text": "Built web app in React."}]
            }
        ],
        "accepted_bullets": [
            {"bullet_id": "b1", "text": "Architected customer-facing React web app."}
        ]
    }
    with patch("backend.app.config.settings.RESEND_API_KEY", ""):
        res = client.post("/api/send-resume", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "api_key_missing"
        assert "RESEND_API_KEY" in data["message"]


def test_send_resume_success_mocked():
    payload = {
        "recipient_email": "recruiter@example.com",
        "target_role": "Lead Architect",
        "sections": [
            {
                "id": "s1",
                "title": "Experience",
                "type": "experience",
                "bullets": [{"id": "b1", "text": "Built scalable cloud microservices."}]
            }
        ],
        "accepted_bullets": [
            {"bullet_id": "b1", "text": "Engineered multi-region cloud microservices in Go and AWS."}
        ]
    }

    mock_send = MagicMock()
    mock_send.return_value = {"id": "resend_test_12345"}

    with patch("backend.app.config.settings.RESEND_API_KEY", "re_test_key_xyz"):
        with patch("resend.Emails.send", mock_send):
            res = client.post("/api/send-resume", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "success"
            assert "resend_test_12345" in data["email_id"]
            assert data["recipient"] == "recruiter@example.com"


def test_send_resume_resend_sandbox_restriction_message():
    """Verify that Resend's testing restriction error produces a clear actionable message."""
    payload = {
        "recipient_email": "other@example.com",
        "sections": [],
        "accepted_bullets": [{"text": "Improved bullet text"}],  # bullet_id omitted
    }

    mock_send = MagicMock()
    mock_send.side_effect = Exception(
        "You can only send testing emails to your own email address (phadshubhy999@gmail.com). "
        "To send emails to other recipients, please verify a domain at resend.com/domains"
    )

    with patch("backend.app.config.settings.RESEND_API_KEY", "re_test_key_xyz"):
        with patch("resend.Emails.send", mock_send):
            res = client.post("/api/send-resume", json=payload)
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "error"
            assert "Resend Sandbox Restriction" in data["message"]
            assert "https://resend.com/domains" in data["message"]
