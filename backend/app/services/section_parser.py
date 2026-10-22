import re
from typing import List, Tuple, Optional, Dict
from ..models import ResumeSection, ResumeItem

# Known section types and their header patterns
SECTION_PATTERNS: Dict[str, List[str]] = {
    "summary": [
        r"professional\s+summary",
        r"executive\s+summary",
        r"career\s+summary",
        r"summary\s+of\s+qualifications",
        r"summary",
        r"professional\s+profile",
        r"personal\s+profile",
        r"profile",
        r"about\s+me",
        r"career\s+objective",
        r"objective",
    ],
    "experience": [
        r"work\s+experience",
        r"professional\s+experience",
        r"employment\s+history",
        r"employment",
        r"work\s+history",
        r"relevant\s+experience",
        r"career\s+history",
        r"experience",
    ],
    "internships": [
        r"internships?",
        r"internship\s+experience",
        r"internship\s+history",
    ],
    "projects": [
        r"academic\s+projects?",
        r"personal\s+projects?",
        r"technical\s+projects?",
        r"key\s+projects?",
        r"selected\s+projects?",
        r"open\s+source\s+projects?",
        r"projects?",
    ],
    "education": [
        r"education",
        r"academic\s+background",
        r"academic\s+history",
        r"educational\s+background",
        r"degrees?",
        r"qualifications",
    ],
    "skills": [
        r"technical\s+skills?",
        r"core\s+competencies",
        r"technologies",
        r"skills\s*(?:&|and)\s*tools",
        r"tools\s*(?:&|and)\s*technologies",
        r"key\s+skills?",
        r"areas\s+of\s+expertise",
        r"programming\s+languages?",
        r"skills?",
    ],
    "certifications": [
        r"certifications?",
        r"certificates?",
        r"licenses\s*(?:&|and)\s*certifications?",
        r"courses?",
        r"training\s*(?:&|and)\s*certifications?",
        r"professional\s+certifications?",
    ],
    "achievements": [
        r"achievements?",
        r"awards?",
        r"honors\s*(?:&|and)\s*awards?",
        r"honors?",
        r"accomplishments?",
        r"key\s+achievements?",
    ],
    "publications": [
        r"publications?",
        r"research\s+publications?",
        r"conferences?\s*(?:&|and)\s*publications?",
        r"papers?",
    ],
}

# Bullet character regex
BULLET_PREFIX_REGEX = re.compile(
    r"^[\s]*(?:[•◦▪▫‣⁃∙·\*\-\+\–\—]|(?:\d+[\.\)]))\s+"
)

# Date pattern to avoid treating company/date lines as section headers
DATE_PATTERN = re.compile(
    r"(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\b|\b\d{4}\b)\s*(?:-|–|—|to)\s*(?:\b(?:Present|Current|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\b|\b\d{4}\b)",
    re.IGNORECASE,
)


def clean_header_text(line: str) -> str:
    """Normalize potential header text by stripping markdown, borders, and punctuation."""
    cleaned = line.strip()
    # Strip markdown headers (##, ###)
    cleaned = re.sub(r"^#+\s*", "", cleaned)
    # Strip surrounding borders like --- or === or [ ]
    cleaned = re.sub(r"^[\-\=\_\~\|\:\*\[\]]+\s*", "", cleaned)
    cleaned = re.sub(r"\s*[\-\=\_\~\|\:\*\[\]]+$", "", cleaned)
    return cleaned.strip()


def classify_section_header(line: str) -> Optional[Tuple[str, str]]:
    """
    Check if a line looks like a resume section header.
    Returns (section_type, cleaned_title) if matched, else None.
    """
    stripped = line.strip()
    if not stripped:
        return None

    # Bullets are never section headers
    if BULLET_PREFIX_REGEX.match(stripped):
        return None

    # If it contains a date range, it's typically a role/company line, not a main section
    if DATE_PATTERN.search(stripped):
        return None

    cleaned = clean_header_text(stripped)
    if not cleaned:
        return None

    # Headers are typically relatively short (1 to 7 words, < 60 chars)
    words = cleaned.split()
    if len(words) > 7 or len(cleaned) > 60:
        return None

    # Sentence ending in period is generally not a header
    if cleaned.endswith(".") and not cleaned.endswith(("etc.", "inc.", "dept.")):
        return None

    norm_text = cleaned.lower()

    # Check known section patterns
    for sec_type, patterns in SECTION_PATTERNS.items():
        for pat in patterns:
            # Match exact phrase or phrase with optional colon
            if re.match(rf"^{pat}\s*:?$", norm_text, re.IGNORECASE):
                # Return category and formatted title (capitalize nicely if it was all caps)
                title = cleaned.rstrip(":")
                return (sec_type, title)

    # Check if line has explicit markdown header indicator (# or ##) or ALL CAPS short words
    is_markdown = stripped.startswith("#")
    is_all_caps = cleaned.isupper() and len(words) <= 4 and len(cleaned) >= 3

    if (is_markdown or is_all_caps) and len(words) <= 4:
        # Generic unrecognized section header
        return ("other", cleaned.rstrip(":"))

    return None


def parse_section_bullets(lines: List[str], sec_idx: int) -> List[ResumeItem]:
    """Extract individual bullet items or paragraphs from raw lines of a section."""
    items: List[ResumeItem] = []
    current_bullet_text: Optional[str] = None
    item_counter = 0

    def flush_current():
        nonlocal current_bullet_text, item_counter
        if current_bullet_text and current_bullet_text.strip():
            final_text = current_bullet_text.strip()
            item_counter += 1
            items.append(
                ResumeItem(
                    id=f"bullet_{sec_idx}_{item_counter}",
                    text=final_text,
                    item_type="bullet",
                    selected=True,
                )
            )
            current_bullet_text = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            # Blank line flushes previous bullet
            flush_current()
            continue

        # Check if line starts with a bullet marker
        bullet_match = BULLET_PREFIX_REGEX.match(raw_line)
        if bullet_match:
            flush_current()
            # Strip the leading bullet marker for clean presentation
            clean_text = raw_line[bullet_match.end() :].strip()
            current_bullet_text = clean_text
        else:
            # Check if this line is a continuation of the current bullet
            if current_bullet_text is not None:
                # Append with space
                current_bullet_text += f" {line}"
            else:
                # Standalone line without bullet marker (e.g. role title or paragraph)
                # Check if it has a comma-separated list or standalone sentence
                item_counter += 1
                items.append(
                    ResumeItem(
                        id=f"bullet_{sec_idx}_{item_counter}",
                        text=line,
                        item_type="paragraph" if DATE_PATTERN.search(line) else "bullet",
                        selected=False if DATE_PATTERN.search(line) else True,
                    )
                )

    flush_current()
    return items


def parse_resume_sections(text: str) -> List[ResumeSection]:
    """
    Main rule-based resume parser that segments text into structured sections and bullets.
    Ensures no text is discarded and returns typed ResumeSection objects.
    """
    if not text or not text.strip():
        return []

    raw_lines = text.splitlines()

    # Find all line indices that are section headers
    header_indices: List[Tuple[int, str, str]] = []  # (line_index, section_type, title)

    for idx, line in enumerate(raw_lines):
        match = classify_section_header(line)
        if match:
            sec_type, title = match
            header_indices.append((idx, sec_type, title))

    sections: List[ResumeSection] = []

    # Case 1: No section headers detected
    if not header_indices:
        bullets = parse_section_bullets(raw_lines, sec_idx=1)
        if bullets:
            sections.append(
                ResumeSection(
                    id="sec_1",
                    title="Resume Content",
                    type="other",
                    bullets=bullets,
                    expanded=True,
                    selected=True,
                )
            )
        return sections

    # Case 2: Content before the first detected header (e.g. contact info or profile)
    first_header_idx = header_indices[0][0]
    if first_header_idx > 0:
        pre_lines = raw_lines[:first_header_idx]
        pre_bullets = parse_section_bullets(pre_lines, sec_idx=0)
        if pre_bullets:
            sections.append(
                ResumeSection(
                    id="sec_0",
                    title="Summary / Profile",
                    type="summary",
                    bullets=pre_bullets,
                    expanded=True,
                    selected=True,
                )
            )

    # Case 3: Process each detected section
    for i, (start_line_idx, sec_type, title) in enumerate(header_indices):
        sec_id_num = len(sections) + 1
        end_line_idx = (
            header_indices[i + 1][0] if i + 1 < len(header_indices) else len(raw_lines)
        )
        section_lines = raw_lines[start_line_idx + 1 : end_line_idx]

        bullets = parse_section_bullets(section_lines, sec_idx=sec_id_num)

        sections.append(
            ResumeSection(
                id=f"sec_{sec_id_num}",
                title=title,
                type=sec_type,
                bullets=bullets,
                expanded=True,
                selected=True,
            )
        )

    return sections
