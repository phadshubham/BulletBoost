from .health import router as health_router
from .parser import router as parser_router
from .ollama import router as ollama_router
from .enhancer import router as enhancer_router
from .classifier import router as classifier_router
from .exporter import router as exporter_router
from .ats import router as ats_router
from .projects import router as projects_router
from .email import router as email_router

__all__ = [
    "health_router",
    "parser_router",
    "ollama_router",
    "enhancer_router",
    "classifier_router",
    "exporter_router",
    "ats_router",
    "projects_router",
    "email_router",
]
