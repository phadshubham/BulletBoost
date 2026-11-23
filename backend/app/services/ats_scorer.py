import re
from typing import List, Dict, Any, Optional, Set, Tuple


# ─────────────────────────────────────────────────────────────────────────────
# 1. COMPREHENSIVE SKILL & KEYWORD TAXONOMY (500+ Industry Standards)
# ─────────────────────────────────────────────────────────────────────────────

KEYWORD_CATALOG: Set[str] = {
    # Programming Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "golang", "go", "rust",
    "ruby", "php", "swift", "kotlin", "scala", "sql", "html", "css", "r", "bash", "shell",
    "perl", "dart", "elixir", "clojure", "haskell", "lua", "matlab", "powershell", "assembly",
    
    # Frontend Frameworks & Libraries
    "react", "react native", "next.js", "vue", "vue.js", "nuxt", "angular", "svelte", "sveltekit",
    "redux", "zustand", "mobx", "tailwind", "tailwind css", "bootstrap", "material ui", "chakra ui",
    "html5", "css3", "sass", "scss", "webpack", "vite", "esbuild", "babel", "three.js", "d3.js",
    "storybook", "jest", "cypress", "playwright", "react query", "tanstack query", "remix",

    # Backend & APIs
    "node.js", "express", "nestjs", "fastapi", "django", "flask", "spring boot", "spring framework",
    "ruby on rails", "asp.net", "asp.net core", ".net core", "gin", "fiber", "actix", "laravel",
    "graphql", "rest", "restful api", "rest api", "grpc", "protobuf", "websocket", "socket.io",
    "microservices", "soa", "service-oriented architecture", "api gateway", "kong", "envoy", "istio",

    # Databases, Cache & Big Data
    "postgresql", "postgres", "mysql", "mariadb", "mongodb", "redis", "elasticsearch", "opensearch",
    "cassandra", "dynamodb", "sqlite", "snowflake", "bigquery", "redshift", "clickhouse", "neo4j",
    "couchbase", "memcached", "kafka", "rabbitmq", "apache spark", "spark", "hadoop", "flink",
    "apache beam", "dbt", "airflow", "presto", "trino", "hive", "scylla", "pinecone", "weaviate",
    "chromadb", "qdrant", "milvus", "vector database",

    # Cloud, Infrastructure & DevOps
    "aws", "amazon web services", "azure", "microsoft azure", "gcp", "google cloud platform",
    "google cloud", "docker", "kubernetes", "k8s", "terraform", "terragrunt", "ansible", "puppet",
    "chef", "ci/cd", "continuous integration", "continuous deployment", "github actions", "gitlab ci",
    "jenkins", "circleci", "argo cd", "argo", "helm", "linux", "unix", "serverless", "aws lambda",
    "ecs", "eks", "fargate", "cloudformation", "s3", "ec2", "rds", "sqs", "sns", "route 53",
    "cloudwatch", "prometheus", "grafana", "datadog", "new relic", "splunk", "jaeger", "opentelemetry",
    "nginx", "traefik", "caddy",

    # AI, Machine Learning & Data Science
    "machine learning", "deep learning", "artificial intelligence", "ai/ml", "data science",
    "generative ai", "genai", "llm", "large language models", "rag", "retrieval-augmented generation",
    "langchain", "llamaindex", "huggingface", "transformers", "pytorch", "tensorflow", "keras",
    "scikit-learn", "pandas", "numpy", "scipy", "xgboost", "lightgbm", "catboost", "opencv",
    "nlp", "natural language processing", "computer vision", "spacy", "nltk", "bert", "gpt",
    "reinforcement learning", "fine-tuning", "lora", "qlora", "mlops", "mlflow", "kubeflow",
    "wandb", "weights & biases", "feature store",

    # Security & Compliance
    "cybersecurity", "information security", "oauth", "oauth2", "saml", "sso", "single sign-on",
    "jwt", "rbac", "iam", "zero trust", "penetration testing", "vulnerability management", "owasp",
    "encryption", "cryptography", "tls/ssl", "soc 2", "gdpr", "hipaa", "pci dss", "iso 27001",
    "burp suite", "wireshark", "sonarqube", "snyk",

    # Software Engineering & Architecture
    "system design", "distributed systems", "high availability", "fault tolerance", "scalability",
    "low latency", "latency optimization", "concurrency", "multithreading", "asynchronous programming",
    "event-driven architecture", "event driven", "cqrs", "domain-driven design", "ddd", "clean architecture",
    "design patterns", "object-oriented programming", "oop", "functional programming", "unit testing",
    "integration testing", "e2e testing", "end-to-end testing", "test automation", "code review",
    "refactoring", "profiling", "benchmarking", "load testing", "k6", "jmeter",

    # Collaboration, Agile & Product
    "agile", "scrum", "kanban", "sprint planning", "jira", "confluence", "git", "github", "gitlab",
    "bitbucket", "ci/cd pipeline", "technical leadership", "mentoring", "cross-functional collaboration",
    "stakeholder management", "product management", "root cause analysis", "incident response",
    "post-mortem", "on-call", "sla", "slo", "sli", "okrs", "kpis", "a/b testing"
}

# Synonym mapping to canonical form for fair matching
KEYWORD_ALIASES: Dict[str, str] = {
    "react.js": "react",
    "reactjs": "react",
    "node": "node.js",
    "nodejs": "node.js",
    "k8s": "kubernetes",
    "postgres": "postgresql",
    "golang": "go",
    "amazon web services": "aws",
    "google cloud platform": "gcp",
    "google cloud": "gcp",
    "ts": "typescript",
    "js": "javascript",
    "py": "python",
    "continuous integration": "ci/cd",
    "continuous deployment": "ci/cd",
    "cicd": "ci/cd",
    "tf": "terraform",
    "ai/ml": "machine learning",
    "ml": "machine learning",
    "dl": "deep learning",
    "genai": "generative ai",
    "llms": "llm",
    "restful": "rest",
    "restful api": "rest",
    "graphql api": "graphql",
}

# Tier-1 high impact action verbs (Google XYZ compliant)
TIER_1_ACTION_VERBS: Set[str] = {
    "accelerated", "achieved", "analyzed", "architected", "automated", "built",
    "championed", "consolidated", "decreased", "delivered", "deployed", "designed",
    "developed", "eliminated", "engineered", "established", "executed", "expanded",
    "expedited", "formulated", "founded", "generated", "implemented", "improved",
    "increased", "initiated", "instituted", "integrated", "launched", "maximized",
    "mentored", "modernized", "negotiated", "optimized", "orchestrated", "overhauled",
    "partnered", "pioneered", "produced", "reduced", "refactored", "resolved",
    "revamped", "saved", "scaled", "slashed", "spearheaded", "standardized",
    "streamlined", "surpassed", "transformed", "unified", "upgraded", "authored",
    "programmed", "devised", "boosted", "doubled", "tripled", "secured"
}

TIER_3_WEAK_VERBS: Set[str] = {
    "assisted", "worked on", "helped", "participated", "handled", "was responsible for",
    "responsible for", "did", "tasked with", "supported", "contributed to", "involved in",
    "attempted", "tried", "learned", "familiar with"
}

# Empty buzzwords / cliches flagged by modern ATS scanners
BUZZWORD_CLICHES: Set[str] = {
    "hardworking", "hard working", "go-getter", "go getter", "team player",
    "detail-oriented", "detail oriented", "synergy", "think outside the box",
    "results-driven", "results driven", "self-starter", "self starter",
    "dynamic", "motivated", "strategic thinker", "passionate", "fast learner",
    "people person", "workaholic", "thought leader"
}


# ─────────────────────────────────────────────────────────────────────────────
# 2. KEYWORD & TERM EXTRACTION (Static Catalog + Dynamic JD NLP)
# ─────────────────────────────────────────────────────────────────────────────

def canonicalize_keyword(kw: str) -> str:
    """Normalize keyword variants to canonical form."""
    k = kw.strip().lower()
    return KEYWORD_ALIASES.get(k, k)


def extract_dynamic_terms(text: str) -> Set[str]:
    """
    Dynamically extract uppercase technical acronyms (2-5 letters like SEO, ERP, SDK, API, ETL, KPI, CRM).
    """
    dynamic_terms = set()
    acronyms = re.findall(r'\b[A-Z]{2,5}\b', text)
    stopwords = {"THE", "AND", "FOR", "WITH", "FROM", "THAT", "THIS", "ARE", "NOT", "YOU", "ALL", "NEW", "OUR", "WHO", "CAN", "BUT"}
    for ac in acronyms:
        if ac.upper() not in stopwords:
            dynamic_terms.add(ac.lower())
    return dynamic_terms


def extract_keywords(text: str) -> Set[str]:
    """
    Extract known technical keywords and tools present in the text,
    normalizing via alias mappings.
    """
    if not text:
        return set()

    lower_text = " " + text.lower() + " "
    matched = set()

    # 1. Match catalog keywords
    for kw in KEYWORD_CATALOG:
        pattern = r'(?:\b|\W)' + re.escape(kw) + r'(?:\b|\W)'
        if re.search(pattern, lower_text):
            matched.add(canonicalize_keyword(kw))

    # 2. Match dynamic terms (acronyms, capitalized technologies)
    for dyn in extract_dynamic_terms(text):
        if len(dyn) >= 2:
            matched.add(canonicalize_keyword(dyn))

    return matched


# ─────────────────────────────────────────────────────────────────────────────
# 3. CONTEXT-AWARE METRIC & GOOGLE X-Y-Z EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_metrics(text: str) -> List[str]:
    """
    Extract genuine business impact metrics, filtering out years (1970-2099),
    dates, single digits, or software version numbers.
    """
    if not text:
        return []

    # Clean text to avoid matching inside version strings like "Python 3.11"
    clean_text = re.sub(r'\b(?:python|node|java|vue|angular|v)\s*\d+(?:\.\d+)+\b', '', text, flags=re.IGNORECASE)

    # 1. Currencies: $100K, $1.5M, $500,000, 50k USD
    # 2. Percentages: 45%, 12.5%
    # 3. Multipliers & Performance: 3x, 10x, 150ms, 2.4s, 500 QPS, 10k TPS, 1,200 req/s
    # 4. Scale & Volume: 10M users, 500k MAU, 50K+, 100+ clients, 40TB
    # 5. Time saved: 15 hours, 3 days
    metric_regex = re.compile(
        r'(\$\s*\d+(?:[\.,]\d+)?\s*(?:k|m|b|billion|million|thousand)?'
        r'|\b\d+(?:[\.,]\d+)?\s*%'
        r'|\b\d+(?:[\.,]\d+)?\s*(?:x|ms|s|sec|qps|tps|req/s|rps|min|hours?|hrs?|days?|x-fold)\b'
        r'|\b\d+(?:[\.,]\d+)?\s*(?:k|m|b|users|customers|clients|accounts|requests|events|records|rows|gb|tb|pb)\b'
        r'|\b\d+\+\b'
        r'|\b(?!(?:19\d\d|20\d\d)\b)\d{1,3}(?:,\d{3})+(?:\.\d+)?\b)',
        re.IGNORECASE
    )

    matches = metric_regex.findall(clean_text)
    valid_metrics = []

    for m in matches:
        m_str = m.strip()
        # Exclude bare 4-digit years between 1970 and 2099
        if re.match(r'^(?:19[7-9]\d|20[0-9]\d)$', m_str):
            continue
        # Exclude single digits without any unit or currency
        if m_str in {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9'}:
            continue
        valid_metrics.append(m_str)

    return valid_metrics


def count_metrics(text: str) -> int:
    """Count quantifiable metrics, filtering out non-impact numbers."""
    return len(extract_metrics(text))


def detect_action_verb(text: str) -> Tuple[Optional[str], int]:
    """
    Detect if bullet starts with a strong action verb (Tier 1 = +25),
    weak verb (Tier 3 = -15), or generic (+5).
    Returns: (verb, score_pts)
    """
    clean_text = re.sub(r'^[•\-\*\s]+', '', text).strip().lower()
    first_words = clean_text.split()
    if not first_words:
        return None, 0

    first_word = first_words[0].rstrip(',.:;')

    # Check 2-word combinations like "worked on", "responsible for"
    two_word = " ".join(first_words[:2]).rstrip(',.:;') if len(first_words) >= 2 else ""
    if two_word in TIER_3_WEAK_VERBS:
        return two_word, -15
    if first_word in TIER_3_WEAK_VERBS:
        return first_word, -15
    if first_word in TIER_1_ACTION_VERBS:
        return first_word, 25

    return first_word, 5


def audit_buzzwords(text: str) -> List[str]:
    """Identify empty buzzwords and cliches in text."""
    lower = " " + text.lower() + " "
    found = []
    for bw in BUZZWORD_CLICHES:
        if re.search(r'(?:\b|\W)' + re.escape(bw) + r'(?:\b|\W)', lower):
            found.append(bw)
    return found


def check_xyz_compliance(text: str) -> bool:
    """
    Evaluates Google X-Y-Z formula compliance:
    Accomplished [X] as measured by [Y], by doing [Z].
    Requires:
    1. Strong active verb
    2. Quantifiable metric
    3. Context or technical execution detail (> 10 words)
    """
    words = text.strip().split()
    if len(words) < 12:
        return False
    _, pts = detect_action_verb(text)
    metrics = extract_metrics(text)
    return pts >= 20 and len(metrics) > 0


# ─────────────────────────────────────────────────────────────────────────────
# 4. SINGLE BULLET ATS EVALUATION
# ─────────────────────────────────────────────────────────────────────────────

def score_single_bullet(text: str, target_keywords: Optional[Set[str]] = None) -> Dict[str, Any]:
    """
    Scores an individual resume bullet point from 0 to 100
    using the 4 industry-standard dimensions.
    """
    if not text or not text.strip():
        return {
            "score": 0.0,
            "metrics_count": 0,
            "metrics": [],
            "has_metric": False,
            "verb": None,
            "verb_tier": "none",
            "verb_score": 0,
            "matched_keywords": [],
            "word_count": 0,
            "is_orphan": False,
            "is_xyz": False,
            "buzzwords": [],
        }

    clean = text.strip()
    words = clean.split()
    word_count = len(words)

    # 1. Action Verb (0 to 30 pts)
    verb, verb_pts = detect_action_verb(clean)
    verb_tier = "strong" if verb_pts >= 20 else "weak" if verb_pts < 0 else "neutral"
    base_verb_score = max(5, min(30, 15 + verb_pts))

    # 2. Measurable Metrics (0 to 35 pts)
    metrics_list = extract_metrics(clean)
    metrics_c = len(metrics_list)
    metric_score = min(35, metrics_c * 18)

    # 3. Keyword Match (0 to 20 pts)
    bullet_kws = extract_keywords(clean)
    if target_keywords:
        overlap = bullet_kws.intersection(target_keywords)
        kw_score = min(20, len(overlap) * 10)
    else:
        kw_score = min(20, len(bullet_kws) * 5)

    # 4. Brevity & Readability (0 to 15 pts)
    if 14 <= word_count <= 35:
        length_score = 15
    elif 8 <= word_count < 14 or 36 <= word_count <= 45:
        length_score = 10
    else:
        length_score = 4

    buzzwords = audit_buzzwords(clean)
    if buzzwords:
        length_score = max(0, length_score - len(buzzwords) * 3)

    is_xyz = check_xyz_compliance(clean)

    # Line orphan detection
    is_orphan = (word_count > 15 and len(words[-1]) <= 6 and len(words[-2]) <= 4 if word_count >= 2 else False)

    total_score = min(100.0, max(10.0, base_verb_score + metric_score + kw_score + length_score))

    return {
        "score": round(total_score, 1),
        "metrics_count": metrics_c,
        "metrics": metrics_list,
        "has_metric": metrics_c > 0,
        "verb": verb,
        "verb_tier": verb_tier,
        "verb_score": base_verb_score,
        "matched_keywords": sorted(list(bullet_kws)),
        "word_count": word_count,
        "is_orphan": is_orphan,
        "is_xyz": is_xyz,
        "buzzwords": buzzwords,
    }


def compute_bullet_ats_delta(
    original_text: str,
    improved_text: str,
    target_keywords: Optional[Set[str]] = None
) -> Dict[str, Any]:
    """
    Computes before vs after ATS score for a single bullet edit,
    including exact point delta and human-readable breakdown.
    """
    orig_res = score_single_bullet(original_text, target_keywords)
    imp_res = score_single_bullet(improved_text, target_keywords)

    delta = round(imp_res["score"] - orig_res["score"], 1)
    breakdown = []

    # 1. Verb improvement
    if orig_res["verb_tier"] != "strong" and imp_res["verb_tier"] == "strong":
        breakdown.append(f"Upgraded to Tier-1 action verb '{imp_res['verb']}' (+{imp_res['verb_score'] - orig_res['verb_score']} pts)")
    
    # 2. Metric addition
    if not orig_res["has_metric"] and imp_res["has_metric"]:
        breakdown.append(f"Introduced verified business metric: {', '.join(imp_res['metrics'][:2])} (+{imp_res['metrics_count'] * 15} pts)")
    elif imp_res["metrics_count"] > orig_res["metrics_count"]:
        breakdown.append(f"Added additional business metrics (+{(imp_res['metrics_count'] - orig_res['metrics_count']) * 10} pts)")

    # 3. Google XYZ formula
    if not orig_res["is_xyz"] and imp_res["is_xyz"]:
        breakdown.append("Achieved Google X-Y-Z formula compliance (Accomplished X, measured by Y, by doing Z)")

    # 4. Keyword match
    new_kws = set(imp_res["matched_keywords"]) - set(orig_res["matched_keywords"])
    if new_kws:
        breakdown.append(f"Incorporated target skill keywords: {', '.join(sorted(list(new_kws))[:3])} (+{len(new_kws) * 5} pts)")

    # 5. Brevity & Readability
    if orig_res["word_count"] < 8 and imp_res["word_count"] >= 14:
        breakdown.append("Expanded minimal bullet into full-scope achievement (+5 pts)")
    elif orig_res["word_count"] > 45 and 14 <= imp_res["word_count"] <= 35:
        breakdown.append("Condensed run-on text into high-impact single line (+5 pts)")

    # 6. Buzzword removal
    removed_bw = set(orig_res["buzzwords"]) - set(imp_res["buzzwords"])
    if removed_bw:
        breakdown.append(f"Eliminated vague buzzwords: {', '.join(removed_bw)} (+5 pts)")

    return {
        "original_score": orig_res["score"],
        "improved_score": imp_res["score"],
        "delta": delta,
        "breakdown": breakdown,
        "matched_keywords": imp_res["matched_keywords"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. COMPREHENSIVE RESUME EVALUATION (4 Industry Pillars)
# ─────────────────────────────────────────────────────────────────────────────

def score_entire_resume(
    sections: List[Dict[str, Any]],
    job_description: Optional[str] = "",
    target_role: Optional[str] = "",
    accepted_bullets: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Evaluates the entire resume against the 4 Industry-Standard ATS pillars:
    1. Keyword & Skills Alignment (40%)
    2. Impact & Google X-Y-Z Formula (30%)
    3. Brevity, Readability & Buzzword Audit (15%)
    4. Structural & Formatting Parsability (15%)

    Supports accepted_bullets map to dynamically reflect accepted rewrites in real time.
    """
    all_bullets = []
    experience_bullets = []
    resume_full_text_parts = []
    section_types_found = set()
    accepted_map = accepted_bullets or {}

    for sec in sections:
        sec_title = sec.get("title", "")
        sec_type = sec.get("type", "other").lower()
        section_types_found.add(sec_type)
        resume_full_text_parts.append(sec_title)

        for b in sec.get("bullets", []):
            b_id = b.get("id", "")
            orig_text = (b.get("text") or "").strip()
            # If bullet has been accepted, substitute its improved text
            # Matches by bullet ID, or by bullet's original text
            b_text = (
                accepted_map.get(b_id)
                or accepted_map.get(orig_text)
                or b.get("text", "")
            )
            if b_text.strip():
                all_bullets.append(b_text)
                resume_full_text_parts.append(b_text)
                if sec_type in {"experience", "internships", "projects", "work experience", "employment"}:
                    experience_bullets.append(b_text)

    resume_full_text = " ".join(resume_full_text_parts)
    resume_keywords = extract_keywords(resume_full_text)

    # ── PILLAR 1: KEYWORD & SKILLS ALIGNMENT (40% Weight) ──
    jd_keywords = set()
    if job_description and job_description.strip():
        jd_keywords = extract_keywords(job_description)
    if not jd_keywords and target_role and target_role.strip():
        jd_keywords = extract_keywords(target_role)

    matched_keywords = sorted(list(resume_keywords.intersection(jd_keywords))) if jd_keywords else sorted(list(resume_keywords))
    missing_keywords = sorted(list(jd_keywords - resume_keywords)) if jd_keywords else []

    if jd_keywords:
        match_ratio = len(matched_keywords) / max(1, len(jd_keywords))
        keyword_score = round(min(100.0, match_ratio * 100), 1)
    else:
        # Fallback if no JD provided: evaluate density and breadth of technical skills
        keyword_score = min(100.0, max(25.0, len(resume_keywords) * 5.0))

    # ── PILLAR 2: IMPACT & GOOGLE X-Y-Z FORMULA (30% Weight) ──
    verbs_used = []
    buzzwords_all = []
    xyz_count = 0
    metric_bullet_count = 0
    strong_verb_count = 0

    target_eval_bullets = experience_bullets if experience_bullets else all_bullets

    if target_eval_bullets:
        bullet_evals = [score_single_bullet(b, jd_keywords) for b in target_eval_bullets]
        for b in bullet_evals:
            if b["has_metric"]:
                metric_bullet_count += 1
            if b["verb_tier"] == "strong":
                strong_verb_count += 1
            if b["is_xyz"]:
                xyz_count += 1
            if b["verb"]:
                verbs_used.append(b["verb"])
            buzzwords_all.extend(b["buzzwords"])

        metric_ratio = metric_bullet_count / max(1, len(target_eval_bullets))
        verb_ratio = strong_verb_count / max(1, len(target_eval_bullets))
        xyz_ratio = xyz_count / max(1, len(target_eval_bullets))

        impact_score = round(min(100.0, (metric_ratio * 40) + (verb_ratio * 35) + (xyz_ratio * 25)), 1)
    else:
        impact_score = 25.0

    # ── PILLAR 3: BREVITY, READABILITY & BUZZWORD AUDIT (15% Weight) ──
    brevity_score = 85.0
    # Audit repetitive verbs (> 2 occurrences)
    verb_counts = {}
    for v in verbs_used:
        verb_counts[v] = verb_counts.get(v, 0) + 1
    repetitive_verbs = [v for v, count in verb_counts.items() if count >= 3]

    if repetitive_verbs:
        brevity_score -= min(25.0, len(repetitive_verbs) * 8.0)

    # Deduct for cliches/buzzwords
    unique_buzzwords = sorted(list(set(buzzwords_all)))
    if unique_buzzwords:
        brevity_score -= min(25.0, len(unique_buzzwords) * 7.0)

    # Word count distribution check
    if all_bullets:
        word_counts = [len(b.split()) for b in all_bullets]
        ideal_count = sum(1 for wc in word_counts if 14 <= wc <= 35)
        ideal_ratio = ideal_count / len(all_bullets)
        brevity_score = (brevity_score * 0.6) + (ideal_ratio * 40.0)

    brevity_score = round(max(20.0, min(100.0, brevity_score)), 1)

    # ── PILLAR 4: STRUCTURAL & ATS PARSABILITY (15% Weight) ──
    structure_score = 45.0
    key_sections = {"experience", "education", "skills", "projects", "summary"}
    found_key = len(section_types_found.intersection(key_sections))
    structure_score += found_key * 10.0  # up to +50

    # Contact info check (email, phone, linkedin)
    has_email = bool(re.search(r'[\w\.-]+@[\w\.-]+\.\w+', resume_full_text))
    has_phone = bool(re.search(r'(?:\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}', resume_full_text))
    if has_email:
        structure_score += 5.0
    if has_phone:
        structure_score += 5.0

    structure_score = round(max(20.0, min(100.0, structure_score)), 1)

    # ── COMPOSITE INDUSTRY ATS SCORE (0 - 100) ──
    composite_score = round(
        (0.40 * keyword_score) +
        (0.30 * impact_score) +
        (0.15 * brevity_score) +
        (0.15 * structure_score),
        1
    )

    # ── ACTIONABLE RECOMMENDATIONS ──
    recommendations = []
    if missing_keywords:
        top_missing = missing_keywords[:5]
        recommendations.append(f"Incorporate missing target keywords from JD: {', '.join(top_missing)}")
    if all_bullets and metric_bullet_count < (len(all_bullets) * 0.5):
        recommendations.append("Add quantifiable metrics (percentages, numbers, latency, revenue) to at least 50% of your bullets.")
    if all_bullets and strong_verb_count < (len(all_bullets) * 0.6):
        recommendations.append("Begin more bullets with Tier-1 action verbs (e.g. Architected, Accelerated, Streamlined).")
    if repetitive_verbs:
        recommendations.append(f"Vary action verbs — '{', '.join(repetitive_verbs[:3])}' is repeated frequently.")
    if unique_buzzwords:
        recommendations.append(f"Replace generic buzzwords ({', '.join(unique_buzzwords[:3])}) with concrete technical contributions.")
    if found_key < 3:
        recommendations.append("Include standard section headings: Experience, Education, Skills, and Projects for optimal ATS parsing.")

    xyz_compliance_rate = round((xyz_count / max(1, len(all_bullets))) * 100, 1)

    return {
        "overall_score": composite_score,
        "keyword_score": keyword_score,
        "impact_score": impact_score,
        "brevity_score": brevity_score,
        "structure_score": structure_score,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "recommendations": recommendations,
        "total_bullets_analyzed": len(all_bullets),
        "buzzwords_detected": unique_buzzwords,
        "repetitive_verbs": repetitive_verbs,
        "xyz_compliance_rate": xyz_compliance_rate,
    }
