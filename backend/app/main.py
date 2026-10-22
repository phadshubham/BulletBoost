from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import (
    health_router,
    parser_router,
    ollama_router,
    enhancer_router,
    classifier_router,
    exporter_router,
)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for BulletBoost — AI-Powered Resume Enhancement",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(parser_router)
app.include_router(ollama_router)
app.include_router(enhancer_router)
app.include_router(classifier_router)
app.include_router(exporter_router)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} v{settings.APP_VERSION}",
        "docs_url": "/docs",
        "health_check": "/api/health",
    }
