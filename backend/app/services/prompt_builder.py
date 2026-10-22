import json
from typing import List, Dict, Any, Optional
from ..models import SelectedBullet


SYSTEM_PROMPT = """You are an expert executive resume editor and career advisor.
Your primary task is to improve the clarity, specificity, conciseness, active voice, and professional syntax of resume bullet points while strictly preserving the source's actual meaning.

### POSITIVE EDITORIAL RUBRIC:
1. ACTIVE SYNTAX & FLOW:
   - Convert awkward or wordy phrasing into polished, executive-level technical action statements.
   - Example: "Built model evaluation using MAE, RMSE and MAPE and generated KPI insights including growth trends." -> "Evaluated forecasting models using MAE, RMSE, and MAPE, generating KPI insights to identify growth trends."
   - Refine clumsy compound clauses without changing technical scope or tools used.
   - Example: "Developed an AI-powered sales forecasting dashboard combining Prophet and Auto-ARIMA for multi-model forecasting." -> "Engineered an AI-powered sales forecasting dashboard integrating Prophet and Auto-ARIMA for multi-model forecasting."
2. RECOGNIZE ALREADY-STRONG BULLETS:
   - If a bullet is already concise, metric-backed, and well-structured (e.g. "Achieved 97.59% validation accuracy across 22,000 validation samples."), do NOT invent arbitrary changes.
   - Set "is_already_clear": true, and keep "improved_text" identical or null with an honest explanation (e.g. "The original bullet is already concise, metric-backed, and well-structured.").

### NON-NEGOTIABLE RULES (ZERO TOLERANCE FOR HALLUCINATION):
1. NEVER INVENT NUMBERS OR METRICS:
   - Do NOT invent percentages (e.g., "25%", "30%"), multipliers ("2x"), time savings, user counts, latency numbers, throughput, or dollar figures.
   - If the source bullet does NOT contain a metric, DO NOT CREATE ONE. A precise technical contribution without numerical metrics is an excellent bullet.
2. NEVER INVENT OUTCOMES OR STOCK ACHIEVEMENT CLAUSES:
   - Do NOT append generic stock endings like "improving throughput by 25%", "reducing system overhead", "increasing efficiency", "driving business impact", or "maximizing performance" unless explicitly substantiated by the source.
3. NEVER INVENT TECHNOLOGIES:
   - Do not introduce libraries, frameworks, databases, or cloud services that were not explicitly mentioned in the source bullet.
4. PRESERVE FACTUAL INTEGRITY:
   - Strictly adhere to the candidate's actual work. "Worked on" or "Helped with" must NOT become "Architected", "Spearheaded", "Led", or "Provisioned". Use accurate verbs such as "Contributed to", "Co-developed", "Assisted with", or "Implemented".
5. PRESERVE GRAMMATICAL INTEGRITY:
   - Never duplicate action verbs (e.g., "Provisioned integrated", "Spearheaded developed").
   - Ensure clean punctuation (no ".,", no trailing commas, no fragments).
6. RELEVANCE OF SUPPORTING FACTS:
   - Supporting facts are candidate evidence. Only incorporate a supporting fact if it is directly and clearly relevant to the specific bullet point. Do not leak facts across unrelated projects.

### FEW-SHOT EXAMPLES OF REQUIRED EDITORIAL BEHAVIOR:

Example 1 (Technical Machine Learning Bullet):
Input: "Integrated a fine-tuned ResNet50 model through REST APIs to classify images as Real or AI-Generated."
Target Role: "Machine Learning Engineer"
Acceptable Rewrite: "Integrated a fine-tuned ResNet50 image-classification model with REST API endpoints to distinguish real versus AI-generated images."
REJECTED Rewrite: "Provisioned integrated a fine-tuned ResNet50 model through REST APIs to classify images as Real or AI-Generated., improving throughput by 25% and reducing system overhead."
(Reason for rejection: Verb duplication 'Provisioned integrated', invented 25% throughput, invented system overhead reduction).

Example 2 (Collaborative Engineering Bullet):
Input: "Worked on code reviews and helped onboard 2 new junior developers."
Target Role: "Senior Software Engineer"
Acceptable Rewrite: "Conducted peer code reviews and assisted with onboarding 2 incoming software engineers."

Example 3 (Bullet with Existing Supported Metric):
Input: "Wrote SQL queries for customer reports, reducing runtime from 5 minutes to 30 seconds."
Target Role: "Data Engineer"
Acceptable Rewrite: "Optimized SQL reporting queries, reducing query execution time from 5 minutes to 30 seconds."

Example 4 (Already Strong and Clear Bullet):
Input: "Achieved 97.59% validation accuracy across 22,000 validation samples."
Target Role: "Machine Learning Engineer"
Acceptable Result:
improved_text: null (or original text)
is_already_clear: true
change_explanation: "The original bullet is already concise, metric-backed, and clearly communicates validation performance."

Output requirement: Return ONLY a valid JSON object with the root key "results" containing an array of enhanced bullet objects."""


def build_enhancement_prompt(
    bullets: List[SelectedBullet],
    target_role: str,
    job_description: Optional[str] = "",
    writing_style: str = "achievement",
    supporting_facts: Optional[str] = "",
) -> List[Dict[str, str]]:
    """Build chat messages for Ollama with strict anti-hallucination instructions and positive editorial rubric."""
    bullets_payload = [
        {
            "bullet_id": b.id,
            "section": b.section_title,
            "text": b.text,
        }
        for b in bullets
    ]

    user_instructions = {
        "target_role": target_role,
        "writing_style": writing_style,
        "job_description": job_description.strip() if job_description else None,
        "supporting_facts_candidate_evidence": supporting_facts.strip() if supporting_facts else None,
        "bullets_to_enhance": bullets_payload,
    }

    schema_example = {
        "results": [
            {
                "bullet_id": bullets[0].id if bullets else "bullet_1_1",
                "improved_text": "Polished, active, grammatical rewrite of the source bullet, or null if already clear.",
                "is_already_clear": False,
                "alternative_texts": ["Optional second faithful variation."],
                "change_explanation": "Specific description of phrasing or grammatical refinements made (or why original is already clear).",
            }
        ]
    }

    user_content = f"""Please edit the following resume bullets for the target role: "{target_role}".
Writing style preference: "{writing_style}".

Input Data:
{json.dumps(user_instructions, indent=2)}

Strict Output Schema:
{json.dumps(schema_example, indent=2)}

Editorial Requirements:
1. Every item in 'bullets_to_enhance' must have an item in 'results' with the exact matching 'bullet_id'.
2. If a bullet is already concise, specific, and metric-backed, set 'is_already_clear': true.
3. If an improvement is possible, refine clarity and active voice. DO NOT invent metrics, numbers, throughput gains, overhead reductions, or tools.
4. Output raw JSON only (no markdown, no preamble)."""

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def build_corrective_prompt(
    original_messages: List[Dict[str, str]],
    raw_error: str,
    violations: Optional[List[str]] = None,
) -> List[Dict[str, str]]:
    """Generate a targeted corrective retry prompt if output failed JSON parsing or evidence validation."""
    if violations and len(violations) > 0:
        feedback = (
            "Your previous proposed rewrite was REJECTED by the evidence validation layer for the following violations:\n"
            + "\n".join(f"- {v}" for v in violations)
            + "\n\nCRITICAL FIX REQUIRED: Rewrite the bullet again. STRICTLY REMOVE all invented metrics, "
            "fabricated outcomes (such as throughput or overhead claims), and duplicated verbs. "
            "Keep the rewrite 100% faithful to the facts in the original bullet text. Output ONLY valid JSON."
        )
    else:
        feedback = (
            f"Your previous response was invalid: {raw_error}. "
            "Please output ONLY valid JSON with the 'results' array. "
            "Do not invent any metrics or tools. No markdown backticks."
        )

    return [
        *original_messages,
        {"role": "user", "content": feedback},
    ]
