from backend.app.services.validator import (
    validate_enhanced_bullet,
    extract_numbers_and_metrics,
    extract_technologies,
)


def test_10_unsupported_numerical_claims_flagged():
    """Scenario 10: Model invents a new metric (e.g. 96% accuracy, 40% reduction) not in source."""
    original = "Worked on a machine learning project using Python."
    # Fabricated metric: 96% and 40%
    improved = "Built a machine learning classification model using Python achieving 96% accuracy and reducing latency by 40%."

    warnings, missing_evidence = validate_enhanced_bullet(original, improved)
    warning_types = [w.type for w in warnings]

    assert "unverified-metric" in warning_types
    # Verify both metrics are flagged
    warning_messages = " ".join([w.message for w in warnings])
    assert "96%" in warning_messages or "96" in warning_messages
    assert "40%" in warning_messages or "40" in warning_messages


def test_11_new_unsupported_technologies_flagged():
    """Scenario 11: Model adds an unsupported tool/framework not in the original text."""
    original = "Built backend APIs using Python."
    improved = "Engineered scalable REST APIs in Python using FastAPI, Redis, and Kubernetes."

    warnings, _ = validate_enhanced_bullet(original, improved)
    warning_types = [w.type for w in warnings]

    assert "added-skill" in warning_types
    warning_messages = " ".join([w.message for w in warnings])
    # Redis and Kubernetes should be flagged as newly added
    assert "Redis" in warning_messages or "Kubernetes" in warning_messages


def test_12_ownership_claims_escalated_flagged():
    """Scenario 12: Model escalates collaborative 'helped' to 'spearheaded' or 'managed'."""
    original = "Helped the team develop the main customer search feature."
    improved = "Spearheaded development of the mission-critical search infrastructure."

    warnings, _ = validate_enhanced_bullet(original, improved)
    warning_types = [w.type for w in warnings]

    assert "vague-claim" in warning_types
    assert any("spearheaded" in w.message.lower() for w in warnings)


def test_13_user_provided_valid_metrics_remain_intact():
    """Scenario 13: User provides real metrics in the bullet or supporting facts — no false alarms."""
    original = "Optimized search query latency by 45%, reducing response time from 1.2s to 180ms."
    improved = "Engineered database query optimizations that reduced latency by 45% (from 1.2s to 180ms)."

    warnings, _ = validate_enhanced_bullet(original, improved)
    # Since 45%, 1.2s, 180ms were in original, they should NOT trigger unverified-metric warnings
    metric_warnings = [w for w in warnings if w.type == "unverified-metric"]
    assert len(metric_warnings) == 0


def test_user_provided_supporting_facts_allow_metrics_and_skills():
    """Valid metrics or tools supplied in supporting_facts are permitted without warnings."""
    original = "Developed backend service for payments."
    supporting_facts = "Used Go and PostgreSQL to process 5,000 transactions per second."
    improved = "Architected a high-throughput payment processing service in Go and PostgreSQL, sustaining 5000 transactions per second."

    warnings, _ = validate_enhanced_bullet(
        original_text=original,
        improved_text=improved,
        supporting_facts=supporting_facts,
    )
    unverified_metrics = [w for w in warnings if w.type == "unverified-metric"]
    added_skills = [w for w in warnings if w.type == "added-skill"]

    assert len(unverified_metrics) == 0
    assert len(added_skills) == 0
