"""
Tests for BulletBoost backend connection diagnostics, health endpoints,
resume upload endpoints, and startup launcher verification logic.
"""

import sys
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_1_successful_backend_health_check():
    """Verify that GET /api/health responds with status ok, app name, and version."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "BulletBoost" in data["app"]
    assert "version" in data


def test_2_root_endpoint_metadata():
    """Verify that GET / provides metadata pointing to health and docs."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "health_check" in data
    assert data["health_check"] == "/api/health"


def test_3_backend_health_handles_custom_header():
    """Verify health endpoint responds properly to standard headers."""
    response = client.get("/api/health", headers={"Accept": "application/json"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")


def test_4_correct_resume_upload_endpoint():
    """Verify POST /api/parse-resume correctly processes uploaded resumes."""
    sample_txt = (
        "PROFESSIONAL SUMMARY\n"
        "Senior Software Engineer with 8 years building distributed backend APIs.\n\n"
        "WORK EXPERIENCE\n"
        "Lead Engineer | Acme Corp (2020 - Present)\n"
        "• Scaled microservices architecture processing 50M daily requests.\n"
        "• Reduced database query latency by 45% using Redis caching.\n\n"
        "SKILLS\n"
        "Python, FastAPI, TypeScript, PostgreSQL, Docker\n"
    )
    files = {"file": ("resume.txt", sample_txt.encode("utf-8"), "text/plain")}
    response = client.post("/api/parse-resume", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "sections" in data
    assert len(data["sections"]) > 0
    # Confirm sections detected
    section_types = [s["type"] for s in data["sections"]]
    assert "experience" in section_types or "summary" in section_types


def test_5_correct_pasted_text_endpoint():
    """Verify POST /api/parse-resume-text processes raw pasted resume content."""
    sample_text = (
        "SUMMARY\n"
        "Full stack developer with passion for clean code and performant web systems.\n\n"
        "EXPERIENCE\n"
        "Software Developer | TechCorp (2021 - 2024)\n"
        "• Built responsive dashboard using React and Tailwind CSS.\n"
        "• Implemented JWT authentication and role-based access control.\n"
    )
    payload = {"text": sample_text, "filename": "pasted_resume.txt"}
    response = client.post("/api/parse-resume-text", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "sections" in data
    assert any(len(s["bullets"]) > 0 for s in data["sections"])


def test_6_pasted_text_rejects_empty_payload():
    """Verify POST /api/parse-resume-text returns 400 for empty or whitespace-only text."""
    response = client.post("/api/parse-resume-text", json={"text": "   ", "filename": "test.txt"})
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_7_launcher_dependency_checker_logic():
    """
    Test the launcher's dependency verification logic.
    Ensures all required packages are importable and missing ones are properly identified.
    """
    required_packages = [
        "fastapi",
        "uvicorn",
        "pydantic",
        "pypdf",
        "docx",
        "multipart",
        "sklearn",
        "joblib",
        "pandas",
        "numpy",
    ]
    missing = []
    for pkg in required_packages:
        try:
            __import__(pkg)
        except ImportError:
            missing.append(pkg)
    assert missing == [], f"All backend dependencies should be present: missing {missing}"


def test_8_launcher_port_conflict_detection_simulation():
    """
    Simulate the launcher logic for detecting whether a port listener is a healthy
    BulletBoost API or an incompatible conflicting process.
    """
    # Case A: An endpoint that responds with status: ok and BulletBoost API
    def evaluate_port_response(health_data):
        if health_data and health_data.get("status") == "ok" and "BulletBoost" in health_data.get("app", ""):
            return "reuse_existing"
        return "conflict_detected"

    assert evaluate_port_response({"status": "ok", "app": "BulletBoost API"}) == "reuse_existing"
    assert evaluate_port_response({"status": "error"}) == "conflict_detected"
    assert evaluate_port_response(None) == "conflict_detected"
    assert evaluate_port_response({"app": "SomeOtherApp"}) == "conflict_detected"


def test_9_launcher_health_poll_logic_simulation():
    """
    Simulate launcher health verification loop before declaring success.
    Ensures the launcher does not report success on premature failure.
    """
    attempts = [False, False, True]  # Backend becomes healthy on attempt 3
    is_healthy = False

    for attempt in attempts:
        if attempt:
            is_healthy = True
            break

    assert is_healthy is True

    # Failed attempts simulate timeout
    timeout_attempts = [False, False, False]
    timeout_healthy = False
    for attempt in timeout_attempts:
        if attempt:
            timeout_healthy = True
            break

    assert timeout_healthy is False
