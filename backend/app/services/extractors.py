import io
import zipfile
from typing import Tuple, List, Optional
from fastapi import HTTPException, status
from pypdf import PdfReader
from pypdf.errors import PdfReadError
import docx
from docx.opc.exceptions import PackageNotFoundError

from ..config import settings
from ..models import ExtractionMetadata


class ExtractedDocument:
    def __init__(
        self,
        text: str,
        metadata: ExtractionMetadata,
        warnings: Optional[List[str]] = None,
    ):
        self.text = text
        self.metadata = metadata
        self.warnings = warnings or []


def validate_file_size(content: bytes) -> None:
    """Validate that the file does not exceed maximum allowed size."""
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"Uploaded file exceeds maximum permitted size of {max_mb:.0f} MB.",
        )


def extract_from_pdf(content: bytes, filename: str) -> ExtractedDocument:
    """Extract text from a PDF file using pypdf."""
    # Check PDF magic bytes (%PDF-)
    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file format. The file header does not match the PDF standard (%PDF-).",
        )

    try:
        reader = PdfReader(io.BytesIO(content))
        page_count = len(reader.pages)
        if page_count == 0:
            return ExtractedDocument(
                text="",
                metadata=ExtractionMetadata(
                    file_type="pdf",
                    char_count=0,
                    word_count=0,
                    page_count=0,
                    extraction_method="pypdf",
                ),
                warnings=["The uploaded PDF has 0 pages."],
            )

        extracted_pages = []
        for page_idx, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            extracted_pages.append(page_text)

        full_text = "\n\n".join(extracted_pages).strip()
        warnings: List[str] = []

        # Check for image-only / scanned PDF
        if len(full_text) == 0:
            warnings.append(
                "The uploaded PDF appears to be scanned or image-based with no extractable text. "
                "BulletBoost currently supports text-based resumes and does not perform OCR. "
                "Please use a text-based PDF or paste your resume text."
            )
        elif len(full_text) < 30:
            warnings.append(
                "Very little text was extracted from this PDF. It may be partially scanned or image-based."
            )

        words = full_text.split()
        return ExtractedDocument(
            text=full_text,
            metadata=ExtractionMetadata(
                file_type="pdf",
                char_count=len(full_text),
                word_count=len(words),
                page_count=page_count,
                extraction_method="pypdf",
            ),
            warnings=warnings,
        )

    except PdfReadError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to read PDF file: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or unsupported PDF file: {str(e)}",
        )


def extract_from_docx(content: bytes, filename: str) -> ExtractedDocument:
    """Extract text from a DOCX file using python-docx."""
    # DOCX files are ZIP archives starting with PK\x03\x04
    if not content.startswith(b"PK\x03\x04"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid DOCX file format. The file is not a valid OpenXML document.",
        )

    try:
        doc = docx.Document(io.BytesIO(content))
        lines: List[str] = []

        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            # If the paragraph style indicates a list bullet, ensure it starts with a bullet marker
            style_name = (p.style.name or "").lower() if p.style else ""
            if "bullet" in style_name or "list" in style_name:
                if not text.startswith(("-", "•", "*", "–", "—")):
                    text = f"• {text}"
            lines.append(text)

        # Also extract from tables if any exist
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    cell_text = cell.text.strip()
                    if cell_text and cell_text not in lines:
                        lines.append(cell_text)

        full_text = "\n".join(lines).strip()
        warnings: List[str] = []

        if len(full_text) == 0:
            warnings.append("The uploaded DOCX file does not contain any readable text.")

        words = full_text.split()
        return ExtractedDocument(
            text=full_text,
            metadata=ExtractionMetadata(
                file_type="docx",
                char_count=len(full_text),
                word_count=len(words),
                page_count=None,
                extraction_method="python-docx",
            ),
            warnings=warnings,
        )

    except (PackageNotFoundError, zipfile.BadZipFile):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed or corrupted DOCX archive.",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading DOCX file: {str(e)}",
        )


def extract_from_txt(content: bytes, filename: str) -> ExtractedDocument:
    """Extract text from a TXT file."""
    # Reject binary files with null bytes
    if b"\x00" in content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid plain text file. The file appears to contain binary data.",
        )

    # Decode using utf-8 or fallback
    try:
        full_text = content.decode("utf-8")
    except UnicodeDecodeError:
        try:
            full_text = content.decode("latin-1")
        except Exception:
            full_text = content.decode("utf-8", errors="replace")

    full_text = full_text.strip()
    warnings: List[str] = []
    if len(full_text) == 0:
        warnings.append("The uploaded text file is empty.")

    words = full_text.split()
    return ExtractedDocument(
        text=full_text,
        metadata=ExtractionMetadata(
            file_type="txt",
            char_count=len(full_text),
            word_count=len(words),
            page_count=None,
            extraction_method="plain_text",
        ),
        warnings=warnings,
    )


def extract_from_raw_text(text: str, filename: Optional[str] = None) -> ExtractedDocument:
    """Prepare extraction document from raw pasted text."""
    clean_text = text.strip()
    warnings: List[str] = []
    if len(clean_text) == 0:
        warnings.append("The provided resume text is empty.")

    words = clean_text.split()
    return ExtractedDocument(
        text=clean_text,
        metadata=ExtractionMetadata(
            file_type="pasted_text",
            char_count=len(clean_text),
            word_count=len(words),
            page_count=None,
            extraction_method="plain_text",
        ),
        warnings=warnings,
    )


def extract_uploaded_file(content: bytes, filename: str) -> ExtractedDocument:
    """Dispatcher for uploaded file content validation and extraction."""
    validate_file_size(content)

    if not filename:
        filename = "resume"

    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == ".pdf":
        return extract_from_pdf(content, filename)
    elif ext == ".docx":
        return extract_from_docx(content, filename)
    elif ext == ".txt":
        return extract_from_txt(content, filename)
    else:
        # Check by content magic bytes if extension is missing or unexpected
        if content.startswith(b"%PDF-"):
            return extract_from_pdf(content, filename)
        elif content.startswith(b"PK\x03\x04"):
            return extract_from_docx(content, filename)
        elif b"\x00" not in content[:1024]:
            return extract_from_txt(content, filename)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported file format. Please upload a PDF, DOCX, or TXT file.",
            )
