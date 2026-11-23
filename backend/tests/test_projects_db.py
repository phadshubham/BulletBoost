import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_create_and_get_project():
    payload = {
        "title": "Full-Stack Dev Application",
        "target_role": "Senior Full-Stack Engineer",
        "job_description": "Proficient in React, Node.js, and PostgreSQL.",
        "writing_style": "achievement",
        "supporting_facts": "Grew monthly active users by 30%.",
        "sections": [
            {
                "id": "sec-1",
                "title": "Experience",
                "type": "experience",
                "bullets": [{"id": "b-1", "text": "Developed customer web app in React."}]
            }
        ],
        "filename": "my_resume.pdf",
        "raw_text": "Sample resume raw text"
    }

    create_res = client.post("/api/projects", json=payload)
    assert create_res.status_code == 200
    data = create_res.json()
    project_id = data["id"]
    assert data["title"] == "Full-Stack Dev Application"
    assert len(data["sections"]) == 1

    # Fetch project
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["id"] == project_id
    assert fetched["target_role"] == "Senior Full-Stack Engineer"


def test_update_project_and_autosave():
    create_res = client.post("/api/projects", json={"title": "Original Title"})
    project_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/projects/{project_id}",
        json={"title": "Updated Title", "target_role": "Tech Lead"}
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["title"] == "Updated Title"
    assert updated["target_role"] == "Tech Lead"


def test_project_fork_variant():
    create_res = client.post(
        "/api/projects",
        json={
            "title": "Master Resume",
            "sections": [
                {
                    "id": "sec-1",
                    "title": "Experience",
                    "type": "experience",
                    "bullets": [{"id": "b-1", "text": "Built distributed services."}]
                }
            ]
        }
    )
    master_id = create_res.json()["id"]

    fork_res = client.post(
        f"/api/projects/{master_id}/fork",
        params={"new_target_role": "Staff Infrastructure Engineer"}
    )
    assert fork_res.status_code == 200
    forked = fork_res.json()
    assert forked["id"] != master_id
    assert "Staff Infrastructure Engineer" in forked["title"]
    assert len(forked["sections"]) == 1


def test_ats_api_endpoints():
    resume_payload = {
        "sections": [
            {
                "id": "sec-1",
                "title": "Experience",
                "type": "experience",
                "bullets": [
                    {"id": "b-1", "text": "Architected Go microservices and deployed to AWS with Docker."}
                ]
            }
        ],
        "job_description": "We need someone with Go, AWS, Docker, and Kubernetes.",
        "target_role": "Cloud Engineer"
    }

    score_res = client.post("/api/ats/score-resume", json=resume_payload)
    assert score_res.status_code == 200
    res_data = score_res.json()
    assert "overall_score" in res_data
    assert "keyword_score" in res_data
    assert "brevity_score" in res_data
    assert "go" in res_data["matched_keywords"]

    # Test single bullet score delta
    bullet_payload = {
        "original": "Worked on backend microservices.",
        "improved": "Architected backend microservices in Python, improving throughput by 40%.",
        "job_description": "Python microservices engineer"
    }
    b_res = client.post("/api/ats/score-bullet", json=bullet_payload)
    assert b_res.status_code == 200
    b_data = b_res.json()
    assert b_data["delta"] > 0
    assert len(b_data["breakdown"]) > 0


def test_enhanced_bullets_persistence():
    create_res = client.post(
        "/api/projects",
        json={
            "title": "Resume with Enhancements",
            "sections": [
                {
                    "id": "sec-exp",
                    "title": "Experience",
                    "type": "experience",
                    "bullets": [{"id": "b-1", "text": "Worked on web app."}]
                }
            ],
            "enhanced_bullets": [
                {
                    "id": "eb-1",
                    "originalBulletId": "b-1",
                    "original": "Worked on web app.",
                    "improved": "Architected customer-facing React web application.",
                    "status": "accepted",
                    "explanation": "Strengthened action verb."
                }
            ]
        }
    )
    assert create_res.status_code == 200
    project_id = create_res.json()["id"]
    assert len(create_res.json()["enhanced_bullets"]) == 1
    assert create_res.json()["enhanced_bullets"][0]["status"] == "accepted"

    # Verify retrieval
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 200
    assert len(get_res.json()["enhanced_bullets"]) == 1
    assert get_res.json()["enhanced_bullets"][0]["improved"] == "Architected customer-facing React web application."

    # Update enhanced bullets
    update_res = client.put(
        f"/api/projects/{project_id}",
        json={
            "enhanced_bullets": [
                {
                    "id": "eb-1",
                    "originalBulletId": "b-1",
                    "original": "Worked on web app.",
                    "improved": "Architected customer-facing React web application.",
                    "status": "rejected",
                    "explanation": "User decided to reject."
                }
            ]
        }
    )
    assert update_res.status_code == 200
    assert update_res.json()["enhanced_bullets"][0]["status"] == "rejected"

    # Verify project list summary counts
    list_res = client.get("/api/projects")
    assert list_res.status_code == 200
    proj_summary = next(p for p in list_res.json() if p["id"] == project_id)
    assert proj_summary["rejected_count"] == 1
    assert proj_summary["accepted_count"] == 0

    # Test uploaded resumes library endpoint
    library_res = client.get("/api/projects/library/resumes")
    assert library_res.status_code == 200
    lib_items = library_res.json()
    assert len(lib_items) >= 1
    assert any(item["filename"] == "resume.txt" or "Resume" in item["filename"] for item in lib_items)
