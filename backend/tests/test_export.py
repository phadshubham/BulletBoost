import io
import docx
from fastapi.testclient import TestClient
from backend.app.models import ResumeSection, ResumeItem, AcceptedBulletExportItem, ExportDocxRequest
from backend.app.services.exporter import generate_resume_docx, sanitize_filename


def test_sanitize_filename():
    assert sanitize_filename("my resume.docx") == "my resume.docx"
    assert sanitize_filename("resume<script>.pdf") == "resumescript.docx"
    assert sanitize_filename("../../../etc/passwd") == "......etcpasswd.docx"
    assert sanitize_filename("") == "enhanced_resume.docx"
    assert sanitize_filename("simple_name") == "simple_name.docx"


def test_generate_resume_docx_in_memory():
    sections = [
        ResumeSection(
            id="sec_summary",
            title="Professional Summary",
            type="summary",
            expanded=True,
            selected=True,
            bullets=[
                ResumeItem(id="b_sum_1", text="Seasoned software engineer with 8 years of experience.", itemType="paragraph", selected=True)
            ]
        ),
        ResumeSection(
            id="sec_exp",
            title="Work Experience",
            type="experience",
            expanded=True,
            selected=True,
            bullets=[
                ResumeItem(id="b_exp_1", text="Helped with the database migration.", itemType="bullet", selected=True),
                ResumeItem(id="b_exp_2", text="Wrote unit tests for the authentication module.", itemType="bullet", selected=True),
            ]
        )
    ]

    accepted_map = {
        "b_exp_1": "Architected and executed zero-downtime database migration for core financial services.",
    }

    doc_bytes = generate_resume_docx(
        sections=sections,
        accepted_bullets_map=accepted_map,
        document_title="Jane Doe Resume",
    )

    assert isinstance(doc_bytes, bytes)
    assert len(doc_bytes) > 0

    # Re-open and verify with python-docx
    doc = docx.Document(io.BytesIO(doc_bytes))
    full_text = "\n".join([p.text for p in doc.paragraphs]).upper()

    # Ensure artificial title header is NOT injected into document body
    assert "JANE DOE RESUME" not in full_text
    assert "PROFESSIONAL SUMMARY" in full_text
    assert "WORK EXPERIENCE" in full_text

    # Check replaced bullet
    raw_text = "\n".join([p.text for p in doc.paragraphs])
    assert "Architected and executed zero-downtime database migration" in raw_text
    assert "Helped with the database migration." not in raw_text

    # Check unaccepted bullet retained original
    assert "Wrote unit tests for the authentication module." in raw_text


def test_export_endpoint_success(client: TestClient):
    payload = {
        "filename": "Candidate_Resume.docx",
        "sections": [
            {
                "id": "sec_1",
                "title": "Experience",
                "type": "experience",
                "expanded": True,
                "selected": True,
                "bullets": [
                    {"id": "b1", "text": "Responsible for managing servers.", "selected": True, "itemType": "bullet"},
                    {"id": "b2", "text": "Worked on frontend features.", "selected": True, "itemType": "bullet"}
                ]
            }
        ],
        "accepted_bullets": [
            {"bullet_id": "b1", "text": "Automated server provisioning and monitoring infrastructure."}
        ]
    }

    response = client.post("/api/export-docx", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert "Candidate_Resume.docx" in response.headers.get("content-disposition", "")

    # Check re-opening the returned document bytes
    doc = docx.Document(io.BytesIO(response.content))
    paragraphs_text = [p.text for p in doc.paragraphs if p.text.strip()]
    
    assert any("EXPERIENCE" in t.upper() for t in paragraphs_text)
    assert any("Automated server provisioning" in t for t in paragraphs_text)
    assert any("Worked on frontend features." in t for t in paragraphs_text)
    assert not any("Responsible for managing servers." in t for t in paragraphs_text)


def test_export_endpoint_empty_accepted_bullets(client: TestClient):
    payload = {
        "filename": "Unchanged_Resume.docx",
        "sections": [
            {
                "id": "sec_edu",
                "title": "Education",
                "type": "education",
                "expanded": True,
                "selected": True,
                "bullets": [
                    {"id": "b_edu_1", "text": "B.S. in Computer Science, University of California.", "selected": True, "itemType": "paragraph"}
                ]
            }
        ],
        "accepted_bullets": []
    }

    response = client.post("/api/export-docx", json=payload)
    assert response.status_code == 200
    doc = docx.Document(io.BytesIO(response.content))
    full_text = "\n".join([p.text for p in doc.paragraphs])
    assert "EDUCATION" in full_text.upper()
    assert "B.S. in Computer Science, University of California." in full_text


def test_export_empty_sections_handled_gracefully(client: TestClient):
    payload = {
        "filename": "empty.docx",
        "sections": [],
        "accepted_bullets": []
    }

    response = client.post("/api/export-docx", json=payload)
    assert response.status_code == 200
    doc = docx.Document(io.BytesIO(response.content))
    assert len(doc.paragraphs) >= 1
