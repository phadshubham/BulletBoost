from fastapi import APIRouter
from ..models import HealthResponse
from ..config import settings

router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health():
    """Health check endpoint indicating that the BulletBoost backend is running."""
    return HealthResponse(
        status="ok",
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
    )
