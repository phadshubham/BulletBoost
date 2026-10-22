from fastapi import APIRouter, HTTPException, status
from ..models import (
    ClassifyBulletsRequest,
    ClassifyBulletsResponse,
    ClassifierStatusResponse,
    EvaluationMetricsResponse,
)
from ..services.classifier_service import classifier_service

router = APIRouter(prefix="/api", tags=["ML Classifier & Evaluation"])


@router.post("/classify-bullets", response_model=ClassifyBulletsResponse)
def classify_bullets_endpoint(request: ClassifyBulletsRequest):
    """
    Classify resume bullet points into quality categories (weak, adequate, strong)
    using the custom-trained scikit-learn pipeline.
    Preserves input identifiers and returns confidence scores.
    """
    if not request.bullets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one bullet point must be provided.",
        )
    if len(request.bullets) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request exceeds maximum limit of 100 bullets.",
        )

    predictions = classifier_service.classify_bullets(request.bullets)
    version = classifier_service.model_version or "1.0.0"
    successful_count = sum(1 for p in predictions if p.status == "success")

    return ClassifyBulletsResponse(
        predictions=predictions,
        model_version=version,
        total_classified=successful_count,
    )


@router.get("/evaluation/metrics", response_model=EvaluationMetricsResponse)
def get_evaluation_metrics_endpoint():
    """
    Retrieve real evaluation metrics from the held-out test split of the trained classifier.
    Returns available=False when no evaluation report exists.
    """
    return classifier_service.get_evaluation_metrics()


@router.get("/classifier/status", response_model=ClassifierStatusResponse)
def get_classifier_status_endpoint():
    """
    Get operational status of the ML classifier model artifact,
    active scikit-learn version, and dataset availability.
    """
    return classifier_service.get_status()
