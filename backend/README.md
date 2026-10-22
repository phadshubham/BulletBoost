# BulletBoost Backend API

FastAPI backend service for BulletBoost, responsible for validating, extracting, and segmenting uploaded resumes (`.pdf`, `.docx`, `.txt`) and pasted resume text into structured sections and bullet points.

## Architecture

- **`backend/app/main.py`**: FastAPI application entrypoint, CORS middleware setup, and root routes.
- **`backend/app/config.py`**: Configuration settings (CORS allowed origins, maximum upload size).
- **`backend/app/models.py`**: Typed Pydantic models aligning with frontend TypeScript data contracts.
- **`backend/app/routers/`**:
  - `health.py`: `GET /api/health`
  - `parser.py`: `POST /api/parse-resume` and `POST /api/parse-resume-text`
- **`backend/app/services/`**:
  - `extractors.py`: In-memory text extraction for PDF (`pypdf`), DOCX (`python-docx`), and plain text. Magic-byte verification and scanned PDF detection.
  - `section_parser.py`: Rule-based section detection (Summary, Experience, Internships, Projects, Education, Skills, Certifications, Achievements, Publications, Other) and bullet segmentation.
- **`backend/tests/`**: Pytest test suite covering valid/invalid files, oversized uploads, scanned PDFs, and schema consistency.

## Setup Instructions

### 1. Create and Activate Virtual Environment

```bash
# From repository root
cd backend
python -m venv venv

# Windows (Command Prompt / PowerShell)
.\venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Development Server
 
**From repository root:**
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Or from `backend/` directory:**
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be accessible at:
- **Health check**: `http://localhost:8000/api/health` or `http://127.0.0.1:8000/api/health`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### 4. Run Automated Tests

```bash
# From repository root
python -m pytest backend/tests -v
```
