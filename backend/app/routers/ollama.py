from fastapi import APIRouter
from ..models import OllamaStatusResponse
from ..services.ollama_service import check_ollama_status

router = APIRouter(prefix="/api/ollama", tags=["Ollama"])


@router.get("/status", response_model=OllamaStatusResponse)
async def get_ollama_status():
    """
    Check availability of the local Ollama service and verify presence
    of the configured LLM model without loading weights into memory.
    """
    return await check_ollama_status()
