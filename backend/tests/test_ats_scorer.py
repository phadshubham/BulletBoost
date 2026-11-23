import pytest
from backend.app.services.ats_scorer import (
    extract_keywords,
    count_metrics,
    detect_action_verb,
    score_single_bullet,
    compute_bullet_ats_delta,
    score_entire_resume,
)


def test_keyword_extraction():
    text = "Engineered microservices using Python, Docker, and PostgreSQL on AWS with Redis caching."
    kws = extract_keywords(text)
    assert "python" in kws
    assert "docker" in kws
    assert "postgresql" in kws
    assert "aws" in kws
    assert "redis" in kws
    assert "microservices" in kws


def test_count_metrics():
    text_with_metrics = "Reduced p99 latency by 45% and scaled system to handle 10,000 QPS saving $50k annually."
    count = count_metrics(text_with_metrics)
    assert count >= 3

    text_no_metrics = "Worked on fixing bugs and attending team meetings."
    assert count_metrics(text_no_metrics) == 0


def test_detect_action_verb():
    # Tier 1 strong verbs
    verb, score = detect_action_verb("Architected cloud native ingestion pipeline.")
    assert verb == "architected"
    assert score == 25

    verb, score = detect_action_verb("Accelerated CI/CD build times.")
    assert verb == "accelerated"
    assert score == 25

    # Tier 3 weak verbs
    verb, score = detect_action_verb("Worked on fixing legacy code.")
    assert "worked on" in verb or verb == "worked"
    assert score == -15

    verb, score = detect_action_verb("Responsible for database backups.")
    assert "responsible for" in verb
    assert score == -15


def test_score_single_bullet_and_delta():
    original = "Worked on backend microservices and helped team fix slow SQL database queries."
    improved = "Architected backend microservices and optimized PostgreSQL query indexes, reducing p99 latency by 42% across 8 production services."

    delta_res = compute_bullet_ats_delta(
        original_text=original,
        improved_text=improved,
        target_keywords={"postgresql", "microservices", "latency optimization"},
    )

    assert delta_res["improved_score"] > delta_res["original_score"]
    assert delta_res["delta"] > 15.0
    assert len(delta_res["breakdown"]) >= 2
    assert any("action verb" in b.lower() for b in delta_res["breakdown"])
    assert any("metric" in b.lower() for b in delta_res["breakdown"])


def test_score_entire_resume():
    sections = [
        {
            "id": "s1",
            "title": "Experience",
            "type": "experience",
            "bullets": [
                {"id": "b1", "text": "Architected distributed payments service in Python and Docker, reducing latency by 35%."},
                {"id": "b2", "text": "Spearheaded PostgreSQL schema migration, decreasing query runtimes by 50% for 200,000 active users."}
            ]
        },
        {
            "id": "s2",
            "title": "Skills",
            "type": "skills",
            "bullets": [
                {"id": "b3", "text": "Python, Docker, Kubernetes, PostgreSQL, Redis, AWS"}
            ]
        }
    ]

    jd = "Seeking a Senior Backend Engineer proficient in Python, Docker, PostgreSQL, and AWS to optimize high-throughput distributed systems."

    res = score_entire_resume(sections, job_description=jd, target_role="Senior Backend Engineer")
    assert res["overall_score"] >= 65.0
    assert res["keyword_score"] >= 70.0
    assert "python" in res["matched_keywords"]
    assert "docker" in res["matched_keywords"]
    assert "postgresql" in res["matched_keywords"]
    assert res["total_bullets_analyzed"] == 3
