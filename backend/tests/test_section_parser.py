from backend.app.services.section_parser import (
    classify_section_header,
    clean_header_text,
    parse_resume_sections,
    parse_section_bullets,
)


def test_clean_header_text():
    assert clean_header_text("## Work Experience") == "Work Experience"
    assert clean_header_text("--- EDUCATION ---") == "EDUCATION"
    assert clean_header_text("=== Technical Skills ===") == "Technical Skills"
    assert clean_header_text("Projects:") == "Projects"


def test_classify_section_headers():
    test_cases = [
        ("PROFESSIONAL SUMMARY", "summary"),
        ("Summary of Qualifications", "summary"),
        ("Career Objective:", "summary"),
        ("WORK EXPERIENCE", "experience"),
        ("Employment History", "experience"),
        ("Relevant Experience", "experience"),
        ("INTERNSHIPS", "internships"),
        ("Academic Projects", "projects"),
        ("Technical Projects", "projects"),
        ("EDUCATION", "education"),
        ("Academic Background", "education"),
        ("TECHNICAL SKILLS", "skills"),
        ("Core Competencies", "skills"),
        ("Programming Languages", "skills"),
        ("CERTIFICATIONS", "certifications"),
        ("Licenses and Certifications", "certifications"),
        ("HONORS AND AWARDS", "achievements"),
        ("Key Achievements", "achievements"),
        ("PUBLICATIONS", "publications"),
        ("Research Publications", "publications"),
        ("LEADERSHIP", "other"),
    ]

    for header_line, expected_type in test_cases:
        result = classify_section_header(header_line)
        assert result is not None, f"Failed to detect header: {header_line}"
        sec_type, title = result
        assert sec_type == expected_type, f"Expected {expected_type} for '{header_line}', got {sec_type}"


def test_classify_non_headers():
    # Bullet points should never be headers
    assert classify_section_header("• Developed a web application") is None
    assert classify_section_header("- Built REST APIs in Python") is None
    # Role date lines should not be main headers
    assert classify_section_header("Software Engineer | Jan 2021 - Present") is None
    # Long sentences should not be headers
    assert classify_section_header("This is a very long sentence that provides an overview of my previous responsibilities.") is None


def test_parse_bullets_characters_and_continuation():
    lines = [
        "• First bullet point about backend development",
        "  that wraps onto a second continuation line.",
        "- Second bullet point with a hyphen prefix",
        "* Third bullet point with an asterisk",
        "1. Fourth bullet point with a number prefix",
    ]
    items = parse_section_bullets(lines, sec_idx=1)
    assert len(items) == 4
    # Check that continuation line was merged with space
    assert "wraps onto a second continuation line" in items[0].text
    assert items[0].text.startswith("First bullet point")
    assert items[1].text.startswith("Second bullet point")
    assert items[2].text.startswith("Third bullet point")
    assert items[3].text.startswith("Fourth bullet point")


def test_parse_resume_sections_full(sample_text: str):
    sections = parse_resume_sections(sample_text)
    assert len(sections) >= 5

    section_titles = [s.title.lower() for s in sections]
    section_types = [s.type for s in sections]

    assert "summary" in section_types
    assert "experience" in section_types
    assert "projects" in section_types
    assert "education" in section_types
    assert "skills" in section_types

    # Verify experience section has bullets
    exp_sec = next(s for s in sections if s.type == "experience")
    assert len(exp_sec.bullets) >= 3
    assert any("Kafka" in b.text for b in exp_sec.bullets)

    # Verify stable IDs
    for sec in sections:
        assert sec.id.startswith("sec_")
        for bullet in sec.bullets:
            assert bullet.id.startswith("bullet_")


def test_parse_empty_text():
    assert parse_resume_sections("") == []
    assert parse_resume_sections("   \n\t  ") == []


def test_parse_text_without_headers():
    raw_bullets = """
• Developed and deployed machine learning pipelines.
• Collaborated with product designers on user journeys.
• Optimized PostgreSQL queries to reduce p99 latency.
    """
    sections = parse_resume_sections(raw_bullets)
    assert len(sections) == 1
    assert sections[0].type == "other"
    assert len(sections[0].bullets) == 3
