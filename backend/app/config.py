import os
from typing import List


class Settings:
    APP_NAME: str = "BulletBoost API"
    APP_VERSION: str = "0.1.0"
    
    # Maximum upload size in bytes (default 10 MB)
    MAX_UPLOAD_SIZE_BYTES: int = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", str(10 * 1024 * 1024)))
    
    # CORS allowed origins
    @property
    def CORS_ORIGINS(self) -> List[str]:
        raw = os.getenv("CORS_ORIGINS", "")
        if raw:
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://[::1]:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://[::1]:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
            "http://[::1]:5175",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "http://[::1]:8000",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]

    # CORS regex allowing any local loopback port for flexible dev environments
    CORS_ORIGIN_REGEX: str = os.getenv(
        "CORS_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"
    )

    # Ollama Local LLM Configuration
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    OLLAMA_TIMEOUT_SECONDS: int = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "180"))
    OLLAMA_KEEP_ALIVE: str = os.getenv("OLLAMA_KEEP_ALIVE", "5m")

    # Custom ML Classifier Configuration
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    MODEL_DIR: str = os.getenv("MODEL_DIR", os.path.join(BASE_DIR, "models"))
    CLASSIFIER_PATH: str = os.getenv("CLASSIFIER_PATH", os.path.join(MODEL_DIR, "bullet_classifier.joblib"))
    EVALUATION_REPORT_PATH: str = os.getenv("EVALUATION_REPORT_PATH", os.path.join(MODEL_DIR, "evaluation_report.json"))
    DATASET_PATH: str = os.getenv("DATASET_PATH", os.path.join(BASE_DIR, "data", "bullet_quality_dataset.csv"))


settings = Settings()
