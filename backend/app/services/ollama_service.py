import time
import json
import logging
import re
import httpx
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status

from ..config import settings
from ..models import (
    OllamaStatusResponse,
    EnhanceBulletsRequest,
    EnhanceBulletsResponse,
    EnhancedBulletResponse,
)
from .prompt_builder import build_enhancement_prompt, build_corrective_prompt
from .validator import (
    validate_enhanced_bullet,
    is_candidate_no_op,
    normalize_bullet_for_comparison,
)

logger = logging.getLogger(__name__)


def is_model_matching(configured: str, candidate: str) -> bool:
    """Compare model names allowing for :latest tag variations."""
    cfg = configured.lower()
    cand = candidate.lower()
    if cfg == cand:
        return True
    if f"{cfg}:latest" == cand:
        return True
    if cfg.endswith(":latest") and cfg[:-7] == cand:
        return True
    return False


async def check_ollama_status() -> OllamaStatusResponse:
    """
    Check if the Ollama local HTTP API is reachable and verify if the configured
    model is installed, querying /api/tags without loading model weights into memory.
    """
    url = f"{settings.OLLAMA_BASE_URL}/api/tags"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(url)
            if res.status_code != 200:
                return OllamaStatusResponse(
                    reachable=False,
                    configured_model=settings.OLLAMA_MODEL,
                    model_installed=False,
                    status_message=f"Ollama server returned HTTP {res.status_code}",
                    error_category="service_unreachable",
                    available_models=[],
                )

            data = res.json()
            models_list = data.get("models", [])
            installed_names = [m.get("name", "") for m in models_list if m.get("name")]

            is_installed = any(
                is_model_matching(settings.OLLAMA_MODEL, name)
                for name in installed_names
            )

            if is_installed:
                return OllamaStatusResponse(
                    reachable=True,
                    configured_model=settings.OLLAMA_MODEL,
                    model_installed=True,
                    status_message=f"Ollama is running and '{settings.OLLAMA_MODEL}' is ready.",
                    error_category=None,
                    available_models=installed_names,
                )
            else:
                return OllamaStatusResponse(
                    reachable=True,
                    configured_model=settings.OLLAMA_MODEL,
                    model_installed=False,
                    status_message=(
                        f"Ollama is running, but model '{settings.OLLAMA_MODEL}' is not downloaded. "
                        f"Run 'ollama pull {settings.OLLAMA_MODEL}' in your terminal."
                    ),
                    error_category="model_missing",
                    available_models=installed_names,
                )

    except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError):
        return OllamaStatusResponse(
            reachable=False,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=False,
            status_message="Ollama is not running. Please start the Ollama application or service.",
            error_category="service_unreachable",
            available_models=[],
        )
    except Exception as e:
        return OllamaStatusResponse(
            reachable=False,
            configured_model=settings.OLLAMA_MODEL,
            model_installed=False,
            status_message=f"Unable to connect to Ollama: {str(e)}",
            error_category="unknown_error",
            available_models=[],
        )


def parse_and_validate_json_payload(content: str) -> Optional[List[Dict[str, Any]]]:
    """Extract and parse JSON payload returned by Ollama."""
    trimmed = content.strip()
    if trimmed.startswith("```json"):
        trimmed = trimmed[7:]
    elif trimmed.startswith("```"):
        trimmed = trimmed[3:]
    if trimmed.endswith("```"):
        trimmed = trimmed[:-3]
    trimmed = trimmed.strip()

    try:
        data = json.loads(trimmed)
        if isinstance(data, dict):
            if "results" in data and isinstance(data["results"], list):
                return data["results"]
            elif "improved" in data or "id" in data or "is_already_clear" in data:
                return [data]
        elif isinstance(data, list):
            return data
    except Exception:
        pass
    return None


def generate_conservative_faithful_rewrite(
    original_text: str,
    target_role: Optional[str] = "",
    role_context: Optional[str] = "",
) -> str:
    """
    Produce a conservative, clean, grammatically sound rewrite strictly preserving original facts.
    Never invents metrics, throughput, or overhead claims.
    """
    cleaned = original_text.strip()
    cleaned = re.sub(r"^[\s•◦▪▫‣⁃∙·*\-–—\d\.\)]+\s*", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = re.sub(r"[\.,;]+$", "", cleaned).strip()
    if cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
    return f"{cleaned}."


async def enhance_bullets_with_ollama(
    request: EnhanceBulletsRequest,
    client: Optional[httpx.AsyncClient] = None,
) -> EnhanceBulletsResponse:
    """
    Execute real LLM enhancement on selected bullets using the local Ollama /api/chat endpoint.
    Enforces deterministic evidence validation and targeted corrective retries.
    If unsupported claims persist, invalid drafts are withheld and safe fallbacks returned.
    """
    start_time = time.perf_counter()

    # Pre-flight health and model check
    status_check = await check_ollama_status()
    if not status_check.reachable:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Ollama is not running. Please start the local Ollama desktop app or service "
                f"at {settings.OLLAMA_BASE_URL} and retry."
            ),
        )
    if not status_check.model_installed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"The configured model '{settings.OLLAMA_MODEL}' is not installed locally in Ollama. "
                f"Please open your terminal and run: ollama pull {settings.OLLAMA_MODEL}"
            ),
        )

    messages = build_enhancement_prompt(
        bullets=request.bullets,
        target_role=request.target_role,
        job_description=request.job_description,
        writing_style=request.writing_style,
        supporting_facts=request.supporting_facts,
    )

    chat_payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "format": "json",
        "keep_alive": settings.OLLAMA_KEEP_ALIVE,
        "options": {
            "temperature": 0.2,
        },
    }

    chat_url = f"{settings.OLLAMA_BASE_URL}/api/chat"

    async def send_chat_request(payload: dict) -> dict:
        timeout_config = httpx.Timeout(settings.OLLAMA_TIMEOUT_SECONDS, connect=10.0)
        if client:
            res = await client.post(chat_url, json=payload, timeout=timeout_config)
        else:
            async with httpx.AsyncClient(timeout=timeout_config) as local_client:
                res = await local_client.post(chat_url, json=payload)

        if res.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Ollama chat endpoint returned HTTP error {res.status_code}: {res.text}",
            )
        return res.json()

    # 1. Primary Inference Attempt
    try:
        response_json = await send_chat_request(chat_payload)
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=f"Ollama inference timed out after {settings.OLLAMA_TIMEOUT_SECONDS}s.",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to communicate with Ollama service: {str(e)}",
        )

    raw_content = response_json.get("message", {}).get("content", "")
    parsed_results = parse_and_validate_json_payload(raw_content)

    # Retry once if JSON parsing failed
    if parsed_results is None:
        logger.warning("First attempt returned invalid JSON. Retrying with corrective prompt.")
        retry_messages = build_corrective_prompt(messages, "Malformed or non-JSON output")
        retry_payload = {**chat_payload, "messages": retry_messages}
        try:
            retry_response = await send_chat_request(retry_payload)
            raw_retry = retry_response.get("message", {}).get("content", "")
            parsed_results = parse_and_validate_json_payload(raw_retry)
        except Exception:
            pass

    if parsed_results is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Ollama model failed to return a valid JSON response structure.",
        )

    # Map candidate results by bullet_id or id
    results_by_id: Dict[str, Dict[str, Any]] = {
        (item.get("bullet_id") or item.get("id")): item
        for item in parsed_results
        if isinstance(item, dict) and (item.get("bullet_id") or item.get("id"))
    }

    # 2. First Pass Validation across all bullets
    bullet_validations = {}
    invalid_bullet_violations: List[str] = []

    for bullet in request.bullets:
        item = results_by_id.get(bullet.id)
        if item:
            improved_candidate = (
                item.get("improved_text") or item.get("improved") or bullet.text
            ).strip()
            if improved_candidate.startswith(("-", "•", "*", "–", "—")):
                improved_candidate = improved_candidate.lstrip("-•*–— ").strip()

            val_res = validate_enhanced_bullet(
                original_text=bullet.text,
                improved_text=improved_candidate,
                supporting_facts=request.supporting_facts,
                target_role=request.target_role,
            )
            bullet_validations[bullet.id] = (item, improved_candidate, val_res)

            if not val_res.is_valid:
                for reason in val_res.rejection_reasons:
                    invalid_bullet_violations.append(f"Bullet '{bullet.id}': {reason}")
            elif is_candidate_no_op(bullet.text, improved_candidate) and not item.get("is_already_clear"):
                invalid_bullet_violations.append(
                    f"Bullet '{bullet.id}': Candidate is identical or materially unchanged from original text. "
                    "Provide a meaningful improvement or clarify phrasing if possible."
                )
        else:
            bullet_validations[bullet.id] = (None, bullet.text, validate_enhanced_bullet(bullet.text, bullet.text))

    # 3. Targeted Corrective Retry (AT MOST ONE RETRY) if any bullet failed validation or returned unchanged
    if invalid_bullet_violations:
        logger.info(
            f"Validation detected {len(invalid_bullet_violations)} violations or unchanged candidates. "
            "Executing single targeted corrective retry with Ollama."
        )
        corrective_messages = build_corrective_prompt(
            original_messages=messages,
            raw_error="Validation rejected candidate or candidate was identical to original",
            violations=invalid_bullet_violations,
        )
        corrective_payload = {**chat_payload, "messages": corrective_messages}

        try:
            retry_json = await send_chat_request(corrective_payload)
            retry_raw = retry_json.get("message", {}).get("content", "")
            retry_parsed = parse_and_validate_json_payload(retry_raw)
            if retry_parsed:
                retry_by_id = {
                    (item.get("bullet_id") or item.get("id")): item
                    for item in retry_parsed
                    if isinstance(item, dict) and (item.get("bullet_id") or item.get("id"))
                }
                # Revalidate retried items
                for bullet in request.bullets:
                    if bullet.id in retry_by_id:
                        retried_item = retry_by_id[bullet.id]
                        retried_candidate = (
                            retried_item.get("improved_text")
                            or retried_item.get("improved")
                            or bullet.text
                        ).strip()
                        if retried_candidate.startswith(("-", "•", "*", "–", "—")):
                            retried_candidate = retried_candidate.lstrip("-•*–— ").strip()

                        re_val_res = validate_enhanced_bullet(
                            original_text=bullet.text,
                            improved_text=retried_candidate,
                            supporting_facts=request.supporting_facts,
                            target_role=request.target_role,
                        )
                        # Replace candidate with retried version
                        bullet_validations[bullet.id] = (retried_item, retried_candidate, re_val_res)
        except Exception as retry_err:
            logger.warning(f"Targeted corrective retry failed: {retry_err}")

    # 4. Final Assembly: Withhold invalid drafts, enforce safe source-faithful fallback, detect no-ops
    enhanced_bullets: List[EnhancedBulletResponse] = []

    for bullet in request.bullets:
        item, candidate_text, val_res = bullet_validations.get(
            bullet.id,
            (None, bullet.text, validate_enhanced_bullet(bullet.text, bullet.text))
        )

        is_no_op = is_candidate_no_op(bullet.text, candidate_text)

        if val_res.is_valid and item is not None and not is_no_op:
            # Model generated a safe, valid, non-identical improvement
            improved_final = candidate_text
            status_final = "pending"
            decision_reason_final = "meaningful_suggestion"
            explanation_final = (
                item.get("change_explanation")
                or item.get("explanation")
                or "Clarified phrasing and strengthened action verbs while strictly preserving facts."
            )
            # Filter alternatives through validation and no-op check
            raw_alts = item.get("alternative_texts", [])
            valid_alts = []
            for alt in raw_alts:
                alt_clean = alt.strip().lstrip("-•*–— ").strip()
                alt_val = validate_enhanced_bullet(
                    original_text=bullet.text,
                    improved_text=alt_clean,
                    supporting_facts=request.supporting_facts,
                    target_role=request.target_role,
                )
                if alt_val.is_valid and not is_candidate_no_op(bullet.text, alt_clean):
                    valid_alts.append(alt_clean)
            alts_final = valid_alts
            warnings_final = val_res.warnings

        elif item is None:
            # Model omitted bullet or generation failed
            improved_final = None
            status_final = "review_needed"
            decision_reason_final = "generation_failed"
            explanation_final = "Unable to produce a safe improvement. Your original text has been preserved."
            alts_final = []
            warnings_final = []

        elif not val_res.is_valid:
            # Validation rejected candidate due to unverified claims or errors
            improved_final = None
            status_final = "review_needed"
            decision_reason_final = (
                "unsupported_claim" if val_res.missing_evidence else "validation_failed"
            )
            reasons_str = (
                "; ".join(val_res.rejection_reasons[:2])
                if val_res.rejection_reasons
                else "Unsupported claims detected"
            )
            explanation_final = (
                f"Unable to produce a safe improvement without unsupported claims. "
                f"Your original text has been preserved. ({reasons_str})"
            )
            alts_final = []
            warnings_final = val_res.warnings

        else:
            # Candidate was identical or only superficial formatting changes were detected
            improved_final = None
            status_final = "no_suggestion"
            alts_final = []
            warnings_final = []

            if item and item.get("is_already_clear") is True:
                decision_reason_final = "original_already_clear"
                explanation_final = (
                    item.get("change_explanation")
                    or "The original bullet is already concise, clear, and well-structured."
                )
            elif bullet.text.strip() == candidate_text.strip():
                decision_reason_final = "unchanged_candidate"
                explanation_final = "The original bullet is already clear, or no meaningful improvement was found."
            else:
                decision_reason_final = "superficial_change"
                explanation_final = (
                    "The original bullet is already clear; only superficial formatting changes were detected."
                )

        enhanced_bullets.append(
            EnhancedBulletResponse(
                id=f"enh_{bullet.id}",
                original_bullet_id=bullet.id,
                section_title=bullet.section_title,
                original=bullet.text,
                improved=improved_final,
                alternative_texts=alts_final,
                explanation=explanation_final,
                quality=None,
                warnings=warnings_final,
                missing_evidence=val_res.missing_evidence if not is_no_op else [],
                status=status_final,
                decision_reason=decision_reason_final,
            )
        )

    duration_ms = (time.perf_counter() - start_time) * 1000

    return EnhanceBulletsResponse(
        bullets=enhanced_bullets,
        model_used=settings.OLLAMA_MODEL,
        enhancement_time_ms=round(duration_ms, 2),
        warnings=[],
    )
