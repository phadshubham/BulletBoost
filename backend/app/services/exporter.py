"""
BulletBoost - Resume Document Export Service
Generates professional Microsoft Word (.docx) documents in memory,
preserving original section hierarchy while substituting explicitly accepted bullet rewrites.
"""

import io
import re
import logging
from typing import List, Dict, Optional
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from ..models import ResumeSection

logger = logging.getLogger(__name__)


def sanitize_filename(filename: Optional[str]) -> str:
    """Sanitize filename to prevent header injection and directory traversal."""
    if not filename or not filename.strip():
        return "enhanced_resume.docx"
    clean = re.sub(r'[\\/*?:"<>|]', "", filename).strip()
    if not clean:
        return "enhanced_resume.docx"
    if clean.lower().endswith(".pdf") or clean.lower().endswith(".txt"):
        clean = clean.rsplit(".", 1)[0]
    if not clean.lower().endswith(".docx"):
        clean += ".docx"
    return clean


def generate_resume_docx(
    sections: List[ResumeSection],
    accepted_bullets_map: Dict[str, str],
    document_title: Optional[str] = None,
) -> bytes:
    """
    Generate a professional Word (.docx) resume in memory.
    Preserves original section ordering and non-modified bullets,
    substituting only explicitly accepted bullet improvements.
    The document body begins directly with the resume sections
    without injecting artificial headings or filenames.
    """
    doc = Document()

    # Set standard professional 0.75-inch margins
    for s in doc.sections:
        s.top_margin = Inches(0.75)
        s.bottom_margin = Inches(0.75)
        s.left_margin = Inches(0.75)
        s.right_margin = Inches(0.75)

    if not sections:
        empty_p = doc.add_paragraph("No resume sections were provided.")
        empty_p.runs[0].font.name = "Calibri"
        empty_p.runs[0].font.size = Pt(11)
        empty_p.runs[0].font.italic = True
        buf = io.BytesIO()
        doc.save(buf)
        return buf.getvalue()

    for sec in sections:
        # Section Heading
        head_p = doc.add_paragraph()
        head_p.paragraph_format.space_before = Pt(14)
        head_p.paragraph_format.space_after = Pt(4)
        head_p.paragraph_format.keep_with_next = True

        head_run = head_p.add_run(sec.title.upper())
        head_run.font.name = "Calibri"
        head_run.font.size = Pt(11.5)
        head_run.font.bold = True
        head_run.font.color.rgb = RGBColor(0x2E, 0x7D, 0x5E)  # Forest Green

        # Add horizontal divider border under section title
        pPr = head_p._p.get_or_add_pPr()
        pBdr = OxmlElement('w:pBdr')
        bottom = OxmlElement('w:bottom')
        bottom.set(qn('w:val'), 'single')
        bottom.set(qn('w:sz'), '6')
        bottom.set(qn('w:space'), '1')
        bottom.set(qn('w:color'), 'CCCCCC')
        pBdr.append(bottom)
        pPr.append(pBdr)

        # Bullets or Paragraphs in this section
        for b in sec.bullets:
            # Substitute accepted text if this bullet was accepted, otherwise preserve original
            bullet_text = accepted_bullets_map.get(b.id, b.text).strip()
            if not bullet_text:
                continue

            if b.item_type == "paragraph":
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.15
                run = p.add_run(bullet_text)
                run.font.name = "Calibri"
                run.font.size = Pt(10.5)
                run.font.color.rgb = RGBColor(0x37, 0x41, 0x51)
            else:
                p = doc.add_paragraph(style='List Bullet')
                p.paragraph_format.space_before = Pt(1.5)
                p.paragraph_format.space_after = Pt(2.5)
                p.paragraph_format.line_spacing = 1.15
                run = p.add_run(bullet_text)
                run.font.name = "Calibri"
                run.font.size = Pt(10.5)
                run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
