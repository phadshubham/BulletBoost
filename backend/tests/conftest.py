import io
import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas
import docx

from backend.app.main import app

SAMPLE_RESUME_TEXT = """
Jane Doe
Software Engineer | jane.doe@example.com | (555) 019-2834

PROFESSIONAL SUMMARY
Results-driven Full Stack Engineer with 5+ years of experience designing scalable distributed systems.
Proven track record in optimizing cloud latency and mentoring high-performing engineering teams.

WORK EXPERIENCE
Senior Software Engineer | CloudTech Solutions
Jan 2021 - Present
• Architected a high-throughput event streaming pipeline using Kafka and FastAPI, processing 15M+ events daily.
• Reduced cloud infrastructure costs by 32% by containerizing legacy workloads with Docker and Kubernetes.
• Mentored 4 junior engineers in test-driven development and clean architectural patterns.

Software Engineer | Beta Corp
Jun 2018 - Dec 2020
• Developed customer-facing React components with TypeScript and Tailwind CSS, increasing user engagement by 25%.
• Designed RESTful microservices in Python and PostgreSQL, improving query response times by 40%.
• Automated CI/CD deployment pipelines using GitHub Actions, decreasing release cycle times from days to hours.

TECHNICAL PROJECTS
Distributed Cache Engine
• Built an in-memory distributed key-value store in Go with Raft consensus.
• Implemented LRU eviction policy achieving sub-millisecond read latencies under load.

EDUCATION
University of California, Berkeley
Bachelor of Science in Computer Science | 2014 - 2018

TECHNICAL SKILLS
• Programming Languages: Python, TypeScript, Go, SQL
• Frameworks & Tools: React, FastAPI, Node.js, Docker, Kubernetes, PostgreSQL, Redis, Kafka
"""


@pytest.fixture
def sample_text() -> str:
    return SAMPLE_RESUME_TEXT.strip()


@pytest.fixture
def valid_txt_bytes(sample_text: str) -> bytes:
    return sample_text.encode("utf-8")


@pytest.fixture
def valid_pdf_bytes(sample_text: str) -> bytes:
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    y = 800
    for line in sample_text.splitlines():
        if y < 50:
            c.showPage()
            y = 800
        # Sanitize non-latin1 characters for basic canvas font if needed
        safe_line = line.replace("•", "*")
        c.drawString(40, y, safe_line[:90])
        y -= 14
    c.save()
    return buffer.getvalue()


@pytest.fixture
def empty_pdf_bytes() -> bytes:
    """PDF with a page but no extractable text."""
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer)
    # Don't draw any text strings
    c.rect(10, 10, 100, 100, fill=0)
    c.save()
    return buffer.getvalue()


@pytest.fixture
def valid_docx_bytes(sample_text: str) -> bytes:
    doc = docx.Document()
    for line in sample_text.splitlines():
        trimmed = line.strip()
        if not trimmed:
            continue
        if trimmed.isupper() and len(trimmed) < 40:
            doc.add_heading(trimmed, level=1)
        elif trimmed.startswith("•"):
            doc.add_paragraph(trimmed[1:].strip(), style="List Bullet")
        else:
            doc.add_paragraph(trimmed)
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
