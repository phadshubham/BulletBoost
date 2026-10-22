import io
from fastapi.testclient import TestClient
from backend.app.config import settings


def test_1_valid_txt_resume_upload(client: TestClient, valid_txt_bytes: bytes):
    files = {"file": ("my_resume.txt", valid_txt_bytes, "text/plain")}
    response = client.post("/api/parse-resume", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "my_resume.txt"
    assert len(data["sections"]) >= 4
    assert data["metadata"]["file_type"] == "txt"
    assert data["metadata"]["extraction_method"] == "plain_text"


def test_2_valid_docx_resume_upload(client: TestClient, valid_docx_bytes: bytes):
    files = {
        "file": (
            "resume.docx",
            valid_docx_bytes,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    }
    response = client.post("/api/parse-resume", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "resume.docx"
    assert len(data["sections"]) >= 3
    assert data["metadata"]["file_type"] == "docx"
    assert data["metadata"]["extraction_method"] == "python-docx"


def test_3_valid_pdf_resume_upload(client: TestClient, valid_pdf_bytes: bytes):
    files = {"file": ("resume.pdf", valid_pdf_bytes, "application/pdf")}
    response = client.post("/api/parse-resume", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "resume.pdf"
    assert len(data["sections"]) >= 3
    assert data["metadata"]["file_type"] == "pdf"
    assert data["metadata"]["extraction_method"] == "pypdf"


def test_4_common_section_header_variations(client: TestClient):
    resume_with_variations = """
Jane Doe | jane@example.com

CAREER OBJECTIVE
Enthusiastic engineer aiming to solve distributed systems challenges.

PROFESSIONAL EXPERIENCE
Senior Architect | TechCorp
• Spearheaded migration to event-driven microservices.

ACADEMIC BACKGROUND
B.S. in Computer Engineering, Stanford University

CORE COMPETENCIES
• Python, Rust, Cloud Native Architecture

HONORS AND AWARDS
• Winner of Annual Hackathon 2022
"""
    response = client.post(
        "/api/parse-resume-text",
        json={"text": resume_with_variations, "filename": "variations.txt"},
    )
    assert response.status_code == 200
    data = response.json()
    sec_types = [s["type"] for s in data["sections"]]
    assert "summary" in sec_types
    assert "experience" in sec_types
    assert "education" in sec_types
    assert "skills" in sec_types
    assert "achievements" in sec_types


def test_5_bullets_inside_experience_and_project_sections(client: TestClient, sample_text: str):
    response = client.post(
        "/api/parse-resume-text",
        json={"text": sample_text},
    )
    assert response.status_code == 200
    data = response.json()

    exp_sec = next(s for s in data["sections"] if s["type"] == "experience")
    assert len(exp_sec["bullets"]) >= 3
    for b in exp_sec["bullets"]:
        assert "id" in b
        assert "text" in b
        assert len(b["text"]) > 0

    proj_sec = next(s for s in data["sections"] if s["type"] == "projects")
    assert len(proj_sec["bullets"]) >= 1


def test_6_empty_and_whitespace_only_content(client: TestClient):
    # Empty pasted text
    res1 = client.post("/api/parse-resume-text", json={"text": ""})
    assert res1.status_code == 400

    res2 = client.post("/api/parse-resume-text", json={"text": "   \n\t  "})
    assert res2.status_code == 400

    # Empty uploaded file
    res3 = client.post(
        "/api/parse-resume",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert res3.status_code == 400


def test_7_invalid_file_types_and_malformed_files(client: TestClient):
    # Executable file
    res1 = client.post(
        "/api/parse-resume",
        files={"file": ("malware.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/octet-stream")},
    )
    assert res1.status_code == 400

    # File named .pdf but actually plain text
    res2 = client.post(
        "/api/parse-resume",
        files={"file": ("fake.pdf", b"This is not a real PDF file at all", "application/pdf")},
    )
    assert res2.status_code == 400

    # File named .docx but actually garbage bytes
    res3 = client.post(
        "/api/parse-resume",
        files={"file": ("fake.docx", b"Not a PK zip file", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert res3.status_code == 400


def test_8_oversized_uploads(client: TestClient):
    oversized_data = b"A" * (settings.MAX_UPLOAD_SIZE_BYTES + 1024)
    files = {"file": ("big.txt", oversized_data, "text/plain")}
    response = client.post("/api/parse-resume", files=files)
    assert response.status_code == 413
    assert "exceeds" in response.json()["detail"].lower()


def test_9_pdfs_with_no_extractable_text(client: TestClient, empty_pdf_bytes: bytes):
    files = {"file": ("scanned.pdf", empty_pdf_bytes, "application/pdf")}
    response = client.post("/api/parse-resume", files=files)
    assert response.status_code == 200
    data = response.json()
    assert len(data["warnings"]) > 0
    assert any("scanned or image-based" in w.lower() for w in data["warnings"])


def test_10_consistent_response_schema_between_upload_and_pasted_text(
    client: TestClient, valid_txt_bytes: bytes, sample_text: str
):
    upload_res = client.post(
        "/api/parse-resume",
        files={"file": ("resume.txt", valid_txt_bytes, "text/plain")},
    )
    paste_res = client.post(
        "/api/parse-resume-text",
        json={"text": sample_text, "filename": "resume.txt"},
    )

    assert upload_res.status_code == 200
    assert paste_res.status_code == 200

    upload_data = upload_res.json()
    paste_data = paste_res.json()

    # Compare top-level keys
    assert set(upload_data.keys()) == set(paste_data.keys())
    assert set(upload_data["metadata"].keys()) == set(paste_data["metadata"].keys())

    # Verify both have sections with identical field structures
    assert len(upload_data["sections"]) == len(paste_data["sections"])
    for u_sec, p_sec in zip(upload_data["sections"], paste_data["sections"]):
        assert set(u_sec.keys()) == set(p_sec.keys())
        assert u_sec["type"] == p_sec["type"]
        assert len(u_sec["bullets"]) == len(p_sec["bullets"])
        for u_b, p_b in zip(u_sec["bullets"], p_sec["bullets"]):
            assert set(u_b.keys()) == set(p_b.keys())
            assert u_b["text"] == p_b["text"]
