from fastapi import APIRouter, HTTPException, status
from ..models import EnhanceBulletsRequest, EnhanceBulletsResponse
from ..services.ollama_service import enhance_bullets_with_ollama

router = APIRouter(prefix="/api", tags=["Enhancement"])


@router.post("/enhance-bullets", response_model=EnhanceBulletsResponse)
async def enhance_bullets_endpoint(request: EnhanceBulletsRequest):
    """
    Enhance selected resume bullets using the local Ollama LLM service.
    Processes only the user's selected bullets, preserves stable IDs,
    and subjects all model proposals to evidence validation.
    """
    if not request.bullets:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one selected bullet is required for enhancement.",
        )
    if not request.target_role.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A target job role must be specified.",
        )

    return await enhance_bullets_with_ollama(request)
