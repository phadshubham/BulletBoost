from fastapi import APIRouter, UploadFile, File, HTTPException, status
from ..models import ParseResumeResponse, ParseTextRequest
from ..services.extractors import extract_uploaded_file, extract_from_raw_text
from ..services.section_parser import parse_resume_sections

router = APIRouter(prefix="/api", tags=["Parser"])


@router.post("/parse-resume", response_model=ParseResumeResponse)
async def parse_resume_file(file: UploadFile = File(...)):
    """
    Accept a multipart file upload containing a PDF, DOCX, or TXT resume.
    Validates file integrity, extracts text in-memory, and parses into structured sections.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename.",
        )

    content = await file.read()
    if not content or len(content.strip()) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # Validate and extract text
    doc = extract_uploaded_file(content, file.filename)

    # Parse sections and bullets
    sections = parse_resume_sections(doc.text)

    # Collect any additional warnings
    warnings = list(doc.warnings)
    if not sections and doc.text.strip():
        warnings.append("No distinct bullet points or sections could be extracted from this document.")

    return ParseResumeResponse(
        filename=file.filename,
        sections=sections,
        warnings=warnings,
        metadata=doc.metadata,
    )


@router.post("/parse-resume-text", response_model=ParseResumeResponse)
def parse_resume_text(payload: ParseTextRequest):
    """
    Accept a JSON request containing raw pasted resume text.
    Segments into structured sections and bullets matching the file upload format.
    """
    if not payload.text or not payload.text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume text cannot be empty or whitespace only.",
        )

    doc = extract_from_raw_text(payload.text, payload.filename)
    sections = parse_resume_sections(doc.text)

    warnings = list(doc.warnings)
    if not sections and doc.text.strip():
        warnings.append("No distinct bullet points or sections could be extracted from this text.")

    return ParseResumeResponse(
        filename=payload.filename or "pasted_resume.txt",
        sections=sections,
        warnings=warnings,
        metadata=doc.metadata,
    )
