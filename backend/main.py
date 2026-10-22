"""
Entrypoint shim allowing 'uvicorn main:app' when executed from inside the backend directory,
or 'backend.main:app' from the repository root.
"""
try:
    from .app.main import app
except ImportError:
    from app.main import app

__all__ = ["app"]
