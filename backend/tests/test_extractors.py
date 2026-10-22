import pytest
from fastapi import HTTPException
from backend.app.services.extractors import (
    extract_uploaded_file,
    extract_from_pdf,
    extract_from_docx,
    extract_from_txt,
    extract_from_raw_text,
    validate_file_size,
)
from backend.app.config import settings


def test_extract_from_txt(valid_txt_bytes: bytes):
    doc = extract_from_txt(valid_txt_bytes, "resume.txt")
    assert doc.metadata.file_type == "txt"
    assert "CloudTech Solutions" in doc.text
    assert doc.metadata.char_count > 100
    assert doc.metadata.word_count > 20
    assert len(doc.warnings) == 0


def test_extract_txt_binary_rejection():
    binary_content = b"Some text with binary \x00\x01\x02 data"
    with pytest.raises(HTTPException) as exc_info:
        extract_from_txt(binary_content, "resume.txt")
    assert exc_info.value.status_code == 400
    assert "binary" in exc_info.value.detail.lower()


def test_extract_from_pdf(valid_pdf_bytes: bytes):
    doc = extract_from_pdf(valid_pdf_bytes, "resume.pdf")
    assert doc.metadata.file_type == "pdf"
    assert doc.metadata.page_count is not None
    assert doc.metadata.page_count >= 1
    assert "Jane Doe" in doc.text or "Software Engineer" in doc.text
    assert doc.metadata.char_count > 50


def test_extract_pdf_invalid_header():
    corrupt_bytes = b"This is not a PDF file"
    with pytest.raises(HTTPException) as exc_info:
        extract_from_pdf(corrupt_bytes, "test.pdf")
    assert exc_info.value.status_code == 400
    assert "PDF" in exc_info.value.detail


def test_extract_pdf_scanned_warning(empty_pdf_bytes: bytes):
    doc = extract_from_pdf(empty_pdf_bytes, "scanned.pdf")
    assert doc.metadata.file_type == "pdf"
    assert len(doc.warnings) > 0
    assert any("scanned or image-based" in w.lower() for w in doc.warnings)


def test_extract_from_docx(valid_docx_bytes: bytes):
    doc = extract_from_docx(valid_docx_bytes, "resume.docx")
    assert doc.metadata.file_type == "docx"
    assert "CloudTech Solutions" in doc.text
    assert doc.metadata.char_count > 100
    assert len(doc.warnings) == 0


def test_extract_docx_invalid_header():
    corrupt_bytes = b"Not a docx zip file"
    with pytest.raises(HTTPException) as exc_info:
        extract_from_docx(corrupt_bytes, "corrupt.docx")
    assert exc_info.value.status_code == 400
    assert "DOCX" in exc_info.value.detail


def test_extract_from_raw_text(sample_text: str):
    doc = extract_from_raw_text(sample_text, "test.txt")
    assert doc.metadata.file_type == "pasted_text"
    assert "Jane Doe" in doc.text
    assert len(doc.warnings) == 0


def test_extract_raw_text_empty():
    doc = extract_from_raw_text("   \n   ", "test.txt")
    assert len(doc.warnings) > 0
    assert "empty" in doc.warnings[0].lower()


def test_validate_file_size_exceeded():
    oversized = b"x" * (settings.MAX_UPLOAD_SIZE_BYTES + 1024)
    with pytest.raises(HTTPException) as exc_info:
        validate_file_size(oversized)
    assert exc_info.value.status_code == 413


def test_extract_uploaded_file_dispatcher(valid_txt_bytes: bytes):
    doc = extract_uploaded_file(valid_txt_bytes, "my_resume.txt")
    assert doc.metadata.file_type == "txt"
