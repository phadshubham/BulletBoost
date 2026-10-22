import re
from typing import List, Tuple, Set, Optional
from ..models import ValidationWarningModel


# Regex pattern for numbers, percentages, metrics, monetary amounts, and multipliers
NUMBER_METRIC_PATTERN = re.compile(
    r"\b(?:\$?\d+(?:[\.,]\d+)?\s*(?:%|k|m|b|x|ms|s|h|sec|min|hours?|days?|months?|years?|fold)?|\d+\+)\b",
    re.IGNORECASE,
)

# Textual representations of percentages and numbers
PERCENT_WORD_PATTERN = re.compile(
    r"\b(\w+(?:-\w+)?)\s+percent\b",
    re.IGNORECASE,
)

# Common technical keywords to detect when introduced without basis
COMMON_TECH_KEYWORDS = {
    "python", "javascript", "typescript", "react", "angular", "vue", "node.js", "nodejs",
    "go", "golang", "rust", "java", "c++", "c#", "ruby", "rails", "php", "laravel",
    "docker", "kubernetes", "k8s", "aws", "azure", "gcp", "terraform", "ansible",
    "postgresql", "postgres", "mysql", "mongodb", "redis", "kafka", "rabbitmq", "celery",
    "graphql", "fastapi", "flask", "django", "express", "spring", "spark", "hadoop",
    "pytorch", "tensorflow", "scikit-learn", "sklearn", "pandas", "numpy", "airflow",
    "elasticsearch", "solr", "dynamodb", "cassandra", "snowflake", "databricks",
    "ci/cd", "jenkins", "github actions", "gitlab ci", "helm", "istio", "linux",
    "resnet", "resnet50", "bert", "gpt", "llm", "transformers", "xgboost", "lightgbm"
}

# Strong ownership / leadership indicators
STRONG_LEADERSHIP_PATTERNS = [
    r"\bspearheaded\b",
    r"\bdirected\b",
    r"\bfounded\b",
    r"\boversaw\b",
    r"\bmanaged\s+(?:a\s+team|engineers|developers|direct\s+reports)\b",
    r"\borchestrated\b",
    r"\bsupervised\b",
    r"\bled\s+(?:a\s+team|\d+\s+engineers)\b",
    r"\bprovisioned\b",
]

# Modest / collaborative indicators in source text
MODEST_ORIGINAL_PATTERNS = [
    r"\bhelped\b",
    r"\bassisted\b",
    r"\bcontributed\s+to\b",
    r"\bparticipated\s+in\b",
    r"\bsupported\b",
    r"\bworked\s+on\b",
    r"\bpart\s+of\s+a\s+team\b",
]

# Stock performance, throughput, and overhead claim patterns
UNVERIFIED_OUTCOME_PATTERNS = [
    (r"\b(?:improving|increased?|boost(?:ing|ed)?|higher)\s+throughput\b", "throughput improvement"),
    (r"\b(?:reduc(?:ing|ed)|lower(?:ing|ed)?|cutting|decreas(?:ing|ed))\s+(?:system\s+)?overhead\b", "system overhead reduction"),
    (r"\b(?:slash(?:ing|ed)|cut(?:ting)?|reduc(?:ing|ed))\s+(?:average\s+)?latency\b", "latency reduction"),
    (r"\b(?:boost(?:ing|ed)?|increas(?:ing|ed)|maximiz(?:ing|ed))\s+efficiency\b", "efficiency gain"),
    (r"\b(?:driv(?:ing|en)|increas(?:ing|ed))\s+revenue\b", "revenue increase"),
    (r"\b(?:cost\s+savings|reduc(?:ing|ed)\s+costs)\b", "cost reduction"),
    (r"\bdriv(?:ing|en)\s+(?:business\s+)?impact\b", "business impact claim"),
]

# Action verb duplication regex (e.g. 'Provisioned integrated', 'Spearheaded developed')
DUPLICATE_VERBS_PATTERN = re.compile(
    r"\b(provisioned|spearheaded|architected|engineered|developed|implemented|"
    r"designed|created|built|led|managed|assisted|helped|contributed|integrated|"
    r"automated|optimized|resolved|authored|established)\s+"
    r"(provisioned|spearheaded|architected|engineered|developed|implemented|"
    r"designed|created|built|led|managed|assisted|helped|contributed|integrated|"
    r"automated|optimized|resolved|authored|established)\b",
    re.IGNORECASE,
)

# Punctuation defect pattern (e.g. '.,', ',.', '..', ', .')
PUNCTUATION_DEFECT_PATTERN = re.compile(r"(\.,|,\.|\.\.|\s+,\s+|\s+\.\s+)")


class ValidationResult(Tuple[List[ValidationWarningModel], List[str]]):
    """
    Validation outcome compatible with (warnings, missing_evidence) tuple unpacking,
    while exposing structured is_valid and rejection_reasons fields.
    """
    warnings: List[ValidationWarningModel]
    missing_evidence: List[str]
    is_valid: bool
    rejection_reasons: List[str]
    grammar_errors: List[str]

    def __new__(
        cls,
        warnings: List[ValidationWarningModel],
        missing_evidence: List[str],
        is_valid: bool = True,
        rejection_reasons: Optional[List[str]] = None,
        grammar_errors: Optional[List[str]] = None,
    ):
        instance = super().__new__(cls, (warnings, missing_evidence))
        instance.warnings = warnings
        instance.missing_evidence = missing_evidence
        instance.is_valid = is_valid
        instance.rejection_reasons = rejection_reasons or []
        instance.grammar_errors = grammar_errors or []
        return instance


def extract_numbers_and_metrics(text: str) -> Set[str]:
    """Extract normalized set of numerical tokens and metric phrases from text."""
    matches = NUMBER_METRIC_PATTERN.findall(text)
    normalized = set()
    for m in matches:
        cleaned = m.strip().lower().replace(",", "")
        if cleaned:
            normalized.add(cleaned)

    # Also detect word forms like "twenty-five percent" or "25 percent"
    word_matches = PERCENT_WORD_PATTERN.findall(text)
    for wm in word_matches:
        normalized.add(f"{wm.lower()} percent")

    return normalized


def extract_technologies(text: str) -> Set[str]:
    """Extract recognized technology names mentioned in text."""
    lower_text = text.lower()
    found = set()
    for tech in COMMON_TECH_KEYWORDS:
        pattern = rf"\b{re.escape(tech)}\b"
        if re.search(pattern, lower_text):
            found.add(tech)
    return found


# Semantic domain categories to correlate relevant supporting facts with bullet points
DOMAIN_CLUSTERS: List[Set[str]] = [
    # Payments / Transactions / Billing
    {
        "payment", "payments", "pay", "transaction", "transactions", "checkout",
        "billing", "invoice", "invoicing", "fintech", "banking", "order", "orders",
        "subscription", "subscriptions"
    },
    # Backend / Databases / Languages
    {
        "backend", "service", "services", "server", "servers",
        "microservice", "microservices", "database", "databases", "sql", "postgresql",
        "postgres", "mysql", "mongodb", "go", "golang", "grpc"
    },
    # Web APIs / REST / Endpoints
    {
        "api", "apis", "rest", "endpoint", "endpoints", "graphql", "http"
    },
    # Machine Learning / AI / Computer Vision / NLP
    {
        "resnet", "resnet50", "image", "images", "vision", "cv", "classification",
        "classify", "model", "models", "inference", "pytorch", "tensorflow", "real",
        "ai-generated", "deep learning", "neural", "nlp", "llm", "transformer"
    },
    # Data Engineering / Queues / Streaming / Caching
    {
        "celery", "redis", "kafka", "rabbitmq", "pipeline", "pipelines", "etl", "ingestion",
        "spark", "hadoop", "records", "daily", "batch", "stream", "streaming"
    },
    # Frontend / Web / UI
    {
        "frontend", "ui", "ux", "react", "vue", "angular", "css", "html",
        "javascript", "typescript", "component", "components", "web", "dom"
    },
    # Cloud / DevOps / CI/CD
    {
        "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "terraform",
        "ci/cd", "deployment", "deploy", "provision", "infrastructure", "cloud"
    },
]


def extract_relevant_supporting_facts(original_text: str, supporting_facts: Optional[str]) -> str:
    """
    Extract ONLY supporting facts that have genuine relevance/overlap with the specific bullet.
    Prevents facts from unrelated projects/bullets from leaking across the resume.
    """
    if not supporting_facts or not supporting_facts.strip():
        return ""

    raw_facts = supporting_facts.strip()
    sentences = re.split(r"[;\n\.]+", raw_facts)

    stop_words = {
        "this", "that", "with", "from", "using", "used", "have", "been", "were",
        "team", "project", "work", "also", "into", "over", "more", "than", "able",
        "the", "and", "for", "our", "all", "per"
    }
    orig_words = {
        w.lower()
        for w in re.findall(r"\b[a-zA-Z0-9_\-\.]{3,}\b", original_text)
        if w.lower() not in stop_words
    }

    orig_techs = extract_technologies(original_text)

    relevant_sentences = []
    for s in sentences:
        s_clean = s.strip()
        if not s_clean:
            continue
        fact_words = {
            w.lower()
            for w in re.findall(r"\b[a-zA-Z0-9_\-\.]{3,}\b", s_clean)
            if w.lower() not in stop_words
        }
        fact_techs = extract_technologies(s_clean)

        # 1. Direct word overlap
        direct_match = bool(orig_words.intersection(fact_words))

        # 2. Tech overlap
        tech_match = bool(orig_techs.intersection(fact_techs))

        # 3. Domain cluster overlap
        cluster_match = any(
            bool(cluster.intersection(orig_words)) and bool(cluster.intersection(fact_words))
            for cluster in DOMAIN_CLUSTERS
        )

        if direct_match or tech_match or cluster_match:
            relevant_sentences.append(s_clean)

    return " ".join(relevant_sentences)


def validate_enhanced_bullet(
    original_text: str,
    improved_text: str,
    supporting_facts: Optional[str] = "",
    target_role: Optional[str] = "",
) -> ValidationResult:
    """
    Enforce deterministic evidence validation on proposed enhancement.
    Detects invented metrics, unverified outcomes, added tools, role inflation,
    and grammatical defects (such as verb duplication).
    """
    warnings: List[ValidationWarningModel] = []
    missing_evidence: List[str] = []
    rejection_reasons: List[str] = []
    grammar_errors: List[str] = []
    is_valid = True

    # 0. Relevant Supporting Facts Scoping
    scoped_facts = extract_relevant_supporting_facts(original_text, supporting_facts)
    combined_source = f"{original_text} {scoped_facts}".lower()

    # 1. Grammar & Coherence Checks
    # 1a. Verb duplication (e.g. 'Provisioned integrated')
    dup_match = DUPLICATE_VERBS_PATTERN.search(improved_text)
    if dup_match:
        err = f"Duplicated action verbs detected: '{dup_match.group(0)}'"
        grammar_errors.append(err)
        rejection_reasons.append(err)
        is_valid = False

    # 1b. Punctuation defects (e.g. '.,')
    punct_match = PUNCTUATION_DEFECT_PATTERN.search(improved_text)
    if punct_match:
        err = f"Punctuation defect detected: '{punct_match.group(0)}'"
        grammar_errors.append(err)
        rejection_reasons.append(err)
        is_valid = False

    # 2. Numerical & Metric Validation
    orig_metrics = extract_numbers_and_metrics(combined_source)
    improved_metrics = extract_numbers_and_metrics(improved_text)

    new_metrics = []
    for m in improved_metrics:
        # Check if metric or raw digit portion exists in original
        digit_only = re.sub(r"[^\d]", "", m)
        orig_digits = {re.sub(r"[^\d]", "", om) for om in orig_metrics}
        if m not in orig_metrics and (not digit_only or digit_only not in orig_digits):
            new_metrics.append(m)

    for metric in new_metrics:
        msg = (
            f"The improvement introduces '{metric}', which was not in your original bullet or relevant supporting facts. "
            "Please verify that this metric accurately reflects your work."
        )
        warnings.append(ValidationWarningModel(type="unverified-metric", message=msg))
        rejection_reasons.append(f"Introduced unsupported metric '{metric}'")
        is_valid = False

    # 3. Unsubstantiated Performance and Outcome Claims (e.g. throughput, overhead)
    for pattern, outcome_label in UNVERIFIED_OUTCOME_PATTERNS:
        match_improved = re.search(pattern, improved_text, re.IGNORECASE)
        match_orig = re.search(pattern, combined_source, re.IGNORECASE)
        if match_improved and not match_orig:
            phrase = match_improved.group(0)
            msg = f"The proposed rewrite introduces an unsupported {outcome_label} ('{phrase}')."
            warnings.append(ValidationWarningModel(type="vague-claim", message=msg))
            rejection_reasons.append(f"Introduced unsupported {outcome_label} ('{phrase}')")
            is_valid = False

    # 4. Technology & Tool Validation
    orig_techs = extract_technologies(combined_source)
    role_techs = extract_technologies(target_role or "")
    allowed_techs = orig_techs.union(role_techs)

    improved_techs = extract_technologies(improved_text)
    added_techs = improved_techs - allowed_techs

    for tech in added_techs:
        display_tech = tech.title() if tech != "ci/cd" else "CI/CD"
        msg = (
            f"The tool or technology '{display_tech}' was added by the editor. "
            "Ensure you have hands-on experience before including it on your resume."
        )
        warnings.append(ValidationWarningModel(type="added-skill", message=msg))
        rejection_reasons.append(f"Introduced unverified technology '{display_tech}'")
        is_valid = False

    # 5. Ownership / Leadership Escalation Validation
    has_modest_source = any(
        re.search(pat, original_text, re.IGNORECASE) for pat in MODEST_ORIGINAL_PATTERNS
    )
    for pat in STRONG_LEADERSHIP_PATTERNS:
        match = re.search(pat, improved_text, re.IGNORECASE)
        if match and has_modest_source:
            claim_term = match.group(0)
            msg = (
                f"Strengthened leadership term '{claim_term}' was introduced for a collaborative task. "
                "Verify this accurately reflects your level of authority."
            )
            warnings.append(ValidationWarningModel(type="vague-claim", message=msg))
            rejection_reasons.append(f"Inflated role with leadership term '{claim_term}'")
            is_valid = False
            break

    # 6. Missing Evidence Signals
    vague_patterns = [
        (r"\bimproved\s+performance\b", "Specific performance metrics (e.g., latency before vs after, % improvement)"),
        (r"\bvarious\s+(?:tasks|projects)\b", "Specific project names or component responsibilities"),
        (r"\bworked\s+with\b", "Specific technical actions taken (e.g. designed, implemented, migrated)"),
        (r"\bresponsible\s+for\b", "Measurable outcomes or deliverables"),
    ]
    for pat, suggestion in vague_patterns:
        if re.search(pat, original_text, re.IGNORECASE) and not orig_metrics:
            missing_evidence.append(suggestion)

    return ValidationResult(
        warnings=warnings,
        missing_evidence=missing_evidence,
        is_valid=is_valid,
        rejection_reasons=rejection_reasons,
        grammar_errors=grammar_errors,
    )


def normalize_bullet_for_comparison(text: Optional[str]) -> str:
    """
    Conservative normalization of bullet text for comparison purposes only.
    Strips leading list markers/bullet glyphs and collapses equivalent whitespace.
    Does NOT alter the underlying stored text.
    """
    if not text:
        return ""
    # Strip leading bullet/list glyphs
    cleaned = re.sub(r"^[\s\u2022\u2023\u25E6\u2043\u2219\*\-\–\—\.]+\s*", "", text)
    # Collapse whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def is_candidate_no_op(original_text: Optional[str], candidate_text: Optional[str]) -> bool:
    """
    Detect whether candidate text is identical or materially equivalent to original text.
    Returns True if candidate offers no meaningful improvement:
      - Empty or null candidate text
      - Identical string after conservative whitespace collapsing
      - Identical text ignoring harmless trailing punctuation / casing
      - Identical word sequence ignoring inconsequential punctuation or capitalization.
    Avoids aggressive similarity thresholds that would suppress legitimate grammar corrections.
    """
    if not candidate_text:
        return True

    norm_orig = normalize_bullet_for_comparison(original_text)
    norm_cand = normalize_bullet_for_comparison(candidate_text)

    if not norm_orig or not norm_cand:
        return True

    # 1. Exact string match after whitespace normalization
    if norm_orig == norm_cand:
        return True

    # 2. Case-insensitive match with trailing punctuation stripped
    strip_trailing = lambda s: re.sub(r"[.\s;,!?:'\"`\u2018\u2019\u201c\u201d]+$", "", s).strip()
    if strip_trailing(norm_orig).lower() == strip_trailing(norm_cand).lower():
        return True

    # 3. Harmless formatting-only / punctuation differences:
    # If the sequence of word tokens (alphanumerics) is 100% identical in order,
    # then no content or grammatical words were changed—only harmless punctuation or capitalization.
    # Note: Minor grammar changes that add, remove, or swap words (e.g. adding 'a', 'the', fixing typos)
    # will have differing word sequences and will return False (legitimate candidate).
    orig_words = [w.lower() for w in re.findall(r"[a-zA-Z0-9]+", norm_orig)]
    cand_words = [w.lower() for w in re.findall(r"[a-zA-Z0-9]+", norm_cand)]
    if orig_words == cand_words:
        return True

    return False

