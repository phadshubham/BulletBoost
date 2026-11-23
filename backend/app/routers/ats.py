from fastapi import APIRouter, HTTPException, status
from ..models import (
    AtsBulletScoreRequest,
    AtsBulletScoreResponse,
    AtsResumeScoreRequest,
    AtsResumeScoreResponse,
    JdGapRequest,
    JdGapResponse,
)
from ..services.ats_scorer import (
    score_single_bullet,
    compute_bullet_ats_delta,
    score_entire_resume,
    extract_keywords,
)

router = APIRouter(prefix="/api/ats", tags=["ATS Scoring Engine"])


@router.post("/score-resume", response_model=AtsResumeScoreResponse)
def score_resume_endpoint(request: AtsResumeScoreRequest):
    """
    Compute full 3-pillar ATS score (Keywords 45%, Impact 35%, Structure 20%)
    against the target job description or role.
    """
    if not request.sections:
        return AtsResumeScoreResponse(
            overall_score=0.0,
            keyword_score=0.0,
            impact_score=0.0,
            structure_score=0.0,
            matched_keywords=[],
            missing_keywords=[],
            recommendations=["Upload or paste your resume to begin ATS evaluation."],
            total_bullets_analyzed=0,
        )

    res = score_entire_resume(
        sections=request.sections,
        job_description=request.job_description,
        target_role=request.target_role,
        accepted_bullets=request.accepted_bullets,
    )
    return AtsResumeScoreResponse(**res)


@router.post("/score-bullet", response_model=AtsBulletScoreResponse)
def score_bullet_endpoint(request: AtsBulletScoreRequest):
    """
    Calculate ATS score for original vs improved bullet and return the net delta (+pts)
    with human-readable improvement breakdown.
    """
    target_kws = extract_keywords(request.job_description) if request.job_description else None
    res = compute_bullet_ats_delta(
        original_text=request.original,
        improved_text=request.improved,
        target_keywords=target_kws,
    )
    return AtsBulletScoreResponse(**res)


@router.post("/jd-gap", response_model=JdGapResponse)
def jd_gap_endpoint(request: JdGapRequest):
    """
    Analyze skill and keyword gaps between the target Job Description and the resume.
    """
    if not request.job_description.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job description cannot be empty.",
        )

    jd_keywords = extract_keywords(request.job_description)
    resume_keywords = extract_keywords(request.resume_text)

    matched = sorted(list(jd_keywords.intersection(resume_keywords)))
    missing = sorted(list(jd_keywords - resume_keywords))

    match_pct = round((len(matched) / max(1, len(jd_keywords))) * 100, 1)

    recommendations = []
    if missing:
        recommendations.append(f"Consider verifying experience with: {', '.join(missing[:4])}")
    else:
        recommendations.append("Excellent keyword coverage against the target job description.")

    return JdGapResponse(
        matched_skills=matched,
        missing_skills=missing,
        match_percentage=match_pct,
        recommendations=recommendations,
    )
