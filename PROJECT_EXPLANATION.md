# BulletBoost — Comprehensive Project Architecture & Technical Explanation

This document is an exhaustive, deep-dive technical reference for the **BulletBoost** (Resume Bullet-Point Enhancer) codebase. It explains every subsystem, data structure, background process, machine learning pipeline, evidence validator, and frontend state transition.

---

## Table of Contents

1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [High-Level Architecture & Data Flow](#2-high-level-architecture--data-flow)
3. [The Three-Layer AI & Validation System](#3-the-three-layer-ai--validation-system)
4. [Frontend Architecture (Everything Happening at the Front)](#4-frontend-architecture-everything-happening-at-the-front)
   - [Technology Stack & File Structure](#technology-stack--file-structure)
   - [Central State Machine: AppContext](#central-state-machine-appcontext)
   - [The Multi-Step Enhancement Wizard](#the-multi-step-enhancement-wizard)
   - [Sequential Review Workstation & Auto-Navigation](#sequential-review-workstation--auto-navigation)
   - [Real-Time Inline Editing & Live ML Reclassification](#real-time-inline-editing--live-ml-reclassification)
   - [Client-Side Heuristic Fallback Engine](#client-side-heuristic-fallback-engine)
   - [API Service & Network Diagnostics](#api-service--network-diagnostics)
   - [Evaluation Lab Page](#evaluation-lab-page)
5. [Backend Architecture (Everything Happening in the Background)](#5-backend-architecture-everything-happening-in-the-background)
   - [Technology Stack & Configuration](#technology-stack--configuration)
   - [Pydantic v2 Data Models](#pydantic-v2-data-models)
   - [FastAPI Router Layer](#fastapi-router-layer)
   - [Multi-Format Document Extraction Engine](#multi-format-document-extraction-engine)
   - [Rule-Based Section & Bullet Parser](#rule-based-section--bullet-parser)
   - [Hardened Prompt Builder & Anti-Injection Rules](#hardened-prompt-builder--anti-injection-rules)
   - [Ollama LLM Orchestration & Corrective Retries](#ollama-llm-orchestration--corrective-retries)
   - [Deterministic Evidence Validator](#deterministic-evidence-validator)
   - [Custom ML Quality Classifier Pipeline](#custom-ml-quality-classifier-pipeline)
   - [In-Memory DOCX Document Exporter](#in-memory-docx-document-exporter)
6. [End-to-End Request Lifecycles & Execution Scenarios](#6-end-to-end-request-lifecycles--execution-scenarios)
   - [Scenario 1: Happy Path with Local Ollama](#scenario-1-happy-path-with-local-ollama)
   - [Scenario 2: Offline / Demo Mode Fallback](#scenario-2-offline--demo-mode-fallback)
   - [Scenario 3: Hallucination Interception & Correction](#scenario-3-hallucination-interception--correction)
   - [Scenario 4: Inline Edit with Live ML Reclassification](#scenario-4-inline-edit-with-live-ml-reclassification)
7. [Automated Testing & Verification Suite (130 Tests)](#7-automated-testing--verification-suite-130-tests)
8. [File-by-File Directory Guide](#8-file-by-file-directory-guide)

---

## 1. Executive Summary & Core Philosophy

### The Core Problem in Modern Resume Tools
Most commercial AI resume builders use unconstrained Large Language Models (LLMs) with generic prompts like *"Make this resume bullet sound impressive and executive."* The result is frequently catastrophic:
- **Invented Metrics**: If a candidate writes *"Built a payment service using Node.js"*, generic LLMs often output *"Built high-throughput payment microservice, increasing revenue by 43% and slashing database latency by 85%"*. Neither the 43% nor the 85% ever happened.
- **Fabricated Technologies**: Tools inject buzzwords like *"Kubernetes, AWS, Terraform, and GraphQL"* even if the candidate has never used them.
- **Inflated Ownership**: A collaborative, junior contribution (*"Helped with code reviews"*) is promoted into false leadership claims (*"Architected and spearheaded team-wide code review standards"*).
- **Destructive Whole-Document Overwrites**: Most tools rewrite the entire document blindly, discarding formatting, altering dates, and replacing original text without letting the user inspect individual modifications.

### The BulletBoost Mission
BulletBoost was engineered to provide **executive-grade phrasing, strong active voice, and role alignment** while maintaining **100% factual integrity**. It enforces a strict policy:

> **"If the source bullet or candidate evidence does not contain a metric, tool, or outcome, the AI is mathematically and deterministically prohibited from introducing one."**

Key architectural tenets:
1. **Human-in-the-Loop**: The candidate must review and explicitly accept each proposed enhancement. Unaccepted bullets remain untouched.
2. **Local Privacy**: When using the local Ollama LLM (`llama3.2:3b`), candidate resumes never leave the local computer.
3. **No-Op Transparency**: If a bullet point is already strong or only superficial formatting changes were found, BulletBoost marks it as `no_suggestion` rather than claiming a false quality uplift.
4. **Independent Machine Learning Benchmarking**: Quality evaluation is separated from text generation using a custom-trained scikit-learn classifier.

---

## 2. High-Level Architecture & Data Flow

BulletBoost is composed of three cooperating runtime subsystems:

```mermaid
flowchart TB
    subgraph Client ["Client Browser (React 19 + TypeScript + Tailwind CSS v4)"]
        UI_IMPORT[1. Resume Importer<br/>PDF, DOCX, TXT, Paste]
        UI_SECTION[2. Section Selector<br/>Granular Bullet Checkboxes]
        UI_PREF[3. Role & Preferences<br/>Target Role, Style, Evidence]
        UI_REVIEW[4. Sequential Review<br/>Accept, Reject, Edit, Regenerate]
        UI_EXPORT[5. Document Downloader<br/>Selective DOCX Substitution]
        UI_EVAL[Evaluation Lab<br/>Held-Out Split Analytics]
        FE_FALLBACK[Heuristic Engine<br/>Offline Fallback]
    end

    subgraph BackendAPI ["Backend API (Python FastAPI - http://127.0.0.1:8000)"]
        API_PARSER[Document Extraction<br/>PyPDF, python-docx, PlainText]
        API_SECT[Section & Bullet Parser<br/>Regex & Continuation Engine]
        API_PROMPT[Prompt Builder<br/>Hardened Anti-Hallucination]
        API_VALID[Deterministic Validator<br/>Metrics, Tools, Roles, Outcomes]
        API_CLASSIFY[ML Classifier Service<br/>TF-IDF + LogisticRegression]
        API_EXPORTER[DOCX Generator<br/>In-Memory Word Builder]
    end

    subgraph InferenceEngine ["Local Inference (Ollama Daemon - http://localhost:11434)"]
        LLM[Ollama llama3.2:3b<br/>Zero Cloud Telemetry]
    end

    UI_IMPORT -->|Upload / Paste| API_PARSER
    API_PARSER --> API_SECT
    API_SECT -->|Structured Sections & Bullets| UI_SECTION
    UI_SECTION --> UI_PREF
    UI_PREF -->|Selected Bullets + Preferences| API_PROMPT
    API_PROMPT -->|Strict JSON Prompt| LLM
    LLM -->|Raw LLM Response| API_VALID
    API_VALID -->|Validated Enhancements / Safe Fallbacks| UI_REVIEW
    UI_REVIEW -->|Batch Bullet Text| API_CLASSIFY
    API_CLASSIFY -->|Quality & Confidence Ratings| UI_REVIEW
    UI_REVIEW -->|Accepted Bullets + Sections| API_EXPORTER
    API_EXPORTER -->|Binary Stream (.docx)| UI_EXPORT
    UI_PREF -.->|If Ollama Offline| FE_FALLBACK
    FE_FALLBACK -.-> UI_REVIEW
```

### Network Communication & Port Allocations
- **Port 5173 (or dynamic 5173–5180)**: React / Vite Development Server hosting the client application.
- **Port 8000**: FastAPI Backend Server providing REST endpoints under `/api/*`.
- **Port 11434**: Local Ollama HTTP daemon hosting the `llama3.2:3b` model.

---

## 3. The Three-Layer AI & Validation System

BulletBoost uses a three-layer defense to guarantee quality and factual accuracy:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: GENERATIVE LLM (Ollama llama3.2:3b)                                │
│ Rewrites bullets using active voice, clarity, and target role vocabulary.    │
│ Governed by a hardened system prompt and strict JSON schema output.        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Raw Candidate Text
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: DETERMINISTIC EVIDENCE VALIDATOR (Python Regex & Tokenizer)        │
│ Rule-based verification enforcing zero tolerance for ungrounded claims.     │
│ - Detects new numerical tokens or percentages not in original text.          │
│ - Detects unauthorized tools and technologies (60+ keyword catalog).        │
│ - Detects leadership inflation (e.g. promoting 'assisted' to 'spearheaded').│
│ - Detects stock outcome claims ('throughput improvement', 'lower latency'). │
│ - Detects grammatical defects (duplicated verbs, punctuation glitches).     │
│ Triggers targeted corrective retry (max 1); withholds invalid drafts.       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Validated Suggestions
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: SCIKIT-LEARN QUALITY CLASSIFIER (TF-IDF + Logistic Regression)      │
│ Independent ML benchmark trained on 183 hand-labeled bullets.               │
│ - Evaluates both Original and Proposed text on a 3-tier rubric.             │
│ - Predicts Quality Tier: Weak, Adequate, or Strong.                         │
│ - Computes empirical confidence ratings (0.0 to 1.0).                       │
│ - Flags predictions with confidence < 0.50 as uncertain.                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Frontend Architecture (Everything Happening at the Front)

### Technology Stack & File Structure
- **React 19.2**: Utilizes the modern React runtime with hooks and functional components.
- **TypeScript 6.0**: Strict type checking across all data structures, API payloads, and state transitions.
- **Tailwind CSS v4**: Utility-first CSS styling using curated HSL color tokens (`forest`, `sage`, `charcoal`, `border`).
- **Vite 8.3**: Build tool and hot module replacement dev server.
- **Lucide React 1.59**: Icons for visual indicators.

```
src/
├── components/
│   ├── enhance/
│   │   ├── ResumeImport.tsx            # Step 1: Upload or paste resume
│   │   ├── SectionAnalysis.tsx         # Step 2: Section hierarchy & checkboxes
│   │   ├── EnhancementPreferences.tsx  # Step 3: Target role, style & facts
│   │   ├── ResultsReview.tsx           # Step 4: Review workstation & export
│   │   └── StepIndicator.tsx           # Visual progress stepper (1 -> 4)
│   ├── layout/
│   │   ├── Layout.tsx                  # Root wrapper with Header and Footer
│   │   ├── Header.tsx                  # Navbar, backend health pill, Ollama badge
│   │   └── Footer.tsx                  # Minimal attribution and status
│   └── ui/
│       ├── Badge.tsx                   # Styled tags (success, warning, info, error)
│       ├── Button.tsx                  # Primary, secondary, outline, ghost buttons
│       └── Input.tsx                   # Form text inputs & textareas
├── context/
│   └── AppContext.tsx                  # Central useReducer state container
├── pages/
│   ├── LandingPage.tsx                 # Hero page, feature list, CTA
│   ├── EnhancePage.tsx                 # Container for the 4-step wizard
│   ├── EvaluationPage.tsx              # Interactive ML Evaluation Lab
│   └── AboutPage.tsx                   # System architecture and status
├── services/
│   ├── api.ts                          # HTTP client for FastAPI backend
│   └── heuristicEnhancer.ts            # Client-side offline fallback engine
├── utils/
│   └── review.ts                       # findNextPendingBulletId navigation algorithm
└── types.ts                            # Complete TypeScript interfaces
```

---

### Central State Machine: AppContext
State management is implemented in [AppContext.tsx](file:///c:/Resume%20Bullet-Point%20Enhancer/src/context/AppContext.tsx) via `useReducer`. It manages the entire application lifecycle through typed actions.

#### Core State Fields (`AppState`)
```typescript
export interface AppState {
  step: 'import' | 'analysis' | 'preferences' | 'results';
  importMethod: 'upload' | 'paste';
  importedFile: ImportedFile | null;
  rawFile: File | null;
  pastedText: string;
  isDemo: boolean;
  sections: ResumeSection[];
  parsingWarnings: string[];
  preferences: EnhancementPreferences;
  enhancedBullets: EnhancedBullet[];
  isProcessing: boolean;
  error: string | null;
  backendHealth: BackendHealthState;
}
```

#### Race-Condition & Stale-Response Protection
When users edit bullet text or when multiple asynchronous classification requests are in flight, `AppContext` protects state integrity using **text matching guards**:
```typescript
case 'SET_BULLET_CLASSIFICATION': {
  const enhancedBullets = state.enhancedBullets.map((b) => {
    if (b.id !== action.bulletId) return b;
    // Check if the prediction matches the current text in the UI
    const origMatches = action.expectedOriginalText === undefined || 
                        action.expectedOriginalText === b.original;
    const currentImproved = b.editedImproved ?? b.improved;
    const impMatches = action.expectedImprovedText === undefined || 
                       action.expectedImprovedText === currentImproved;

    return {
      ...b,
      originalQuality: origMatches ? action.originalQuality : b.originalQuality,
      improvedQuality: impMatches ? action.improvedQuality : b.improvedQuality,
      // ...
    };
  });
  return { ...state, enhancedBullets };
}
```
If an asynchronous prediction arrives for an older version of a bullet that the user has already edited, the stale prediction is safely discarded.

---

### The Multi-Step Enhancement Wizard

#### Step 1: Resume Import (`ResumeImport.tsx`)
- Supports drag-and-drop or file browsing for `.pdf`, `.docx`, and `.txt` files.
- Provides a tab for direct copy-pasted text.
- Includes a **"Try Sample Resume"** button that immediately loads a sample resume showcasing technical machine learning, backend engineering, and QA bullets.
- Performs client-side file size checks (rejecting files > 10 MB before upload).

#### Step 2: Section Analysis (`SectionAnalysis.tsx`)
- Displays all sections detected by the backend parser in hierarchical cards.
- Each section features an accordion toggle, title, detected category badge (*Experience, Projects, Education, etc.*), and word count.
- Granular bullet checkboxes allow users to select or deselect individual bullets or entire sections.

#### Step 3: Enhancement Preferences (`EnhancementPreferences.tsx`)
- **Target Role**: Specific job title (e.g. *"Senior Backend Engineer"*).
- **Writing Style**: Radio selector for:
  - `achievement`: Emphasizes delivered outcomes and technical contributions.
  - `technical`: Emphasizes architecture, frameworks, and system precision.
  - `concise`: Shortens bullets to essential facts and tight phrasing.
- **Job Description (Optional)**: Provides domain keywords for tailoring.
- **Supporting Facts Candidate Evidence (Optional)**: Candidate background notes (e.g., *"Reduced query latency from 850ms to 95ms using Redis"*). The validator permits these facts only for relevant bullets.
- **Ollama Status Banner**: Proactively verifies if the local LLM is reachable and if `llama3.2:3b` is pulled.

---

### Sequential Review Workstation & Auto-Navigation
The review screen in [ResultsReview.tsx](file:///c:/Resume%20Bullet-Point%20Enhancer/src/components/enhance/ResultsReview.tsx) functions as a focused review environment:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Filter: [All (7)]  [Needs Review (5)]  [Accepted (2)]  [Rejected (0)]       │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ SECTION: Experience                                 STATUS: Pending     │ │
│ │                                                                         │ │
│ │ ORIGINAL TEXT:                                                          │ │
│ │ "Built model evaluation using MAE, RMSE and MAPE and generated KPI      │ │
│ │  insights including growth trends."                                     │ │
│ │ [Badge: Original: Adequate (64% model confidence)]                      │ │
│ │                                                                         │ │
│ │ PROPOSED REWRITE:                                                       │ │
│ │ "Evaluated forecasting models using MAE, RMSE, and MAPE, generating     │ │
│ │  KPI insights to identify growth trends."                               │ │
│ │ [Badge: Proposed: Strong (88% model confidence)]                        │ │
│ │                                                                         │ │
│ │ WHY THIS CHANGED:                                                       │ │
│ │ Replaced conversational phrasing with direct active verb; clarified     │ │
│ │ purpose without inventing unsupported metrics.                          │ │
│ │                                                                         │ │
│ │ [✓ Accept]    [✗ Reject]    [✎ Edit]    [🔄 Regenerate]                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Auto-Advancing Sequential Review (`findNextPendingBulletId`)
When the candidate clicks **Accept** or **Reject**, the system automatically advances to the next pending item:
1. `handleAccept(id)` or `handleReject(id)` updates the bullet status in state.
2. It calls `findNextPendingBulletId(state.enhancedBullets, currentId)` defined in [review.ts](file:///c:/Resume%20Bullet-Point%20Enhancer/src/utils/review.ts):
   - First checks subsequent bullets (`currentIndex + 1` to end) for status `'pending'` or `'review_needed'`.
   - If none found, wraps around and checks from index 0 up to `currentIndex`.
   - Returns `null` if all bullets have been reviewed.
3. It sets `expandedId` to the next pending bullet and triggers a smooth scroll into the viewport via `scrollTargetRef`.

---

### Real-Time Inline Editing & Live ML Reclassification
When the candidate clicks **Edit**:
1. An inline textarea opens with the current improved text.
2. The user modifies the wording.
3. Upon clicking **Save**:
   - `validateEditedText` immediately checks if the edit introduced ungrounded numbers or outcome phrases.
   - `isCandidateNoOp` checks if the edit was empty or identical to the original text.
   - An asynchronous request is dispatched to `/api/classify-bullets` with the edited text.
   - As soon as the ML classifier responds, the proposed badge updates with the new quality tier and confidence rating in real time.

---

### Client-Side Heuristic Fallback Engine
Defined in [heuristicEnhancer.ts](file:///c:/Resume%20Bullet-Point%20Enhancer/src/services/heuristicEnhancer.ts), this engine provides offline functionality when Ollama is not installed or when the user clicks **"Skip Wait & Proceed Instantly"**:
- **Curated High-Quality Mappings**: Matches exact benchmark bullets from the sample resume to human-curated enhancements.
- **Rule-Based Phrasing Optimizer**:
  - Detects and replaces passive openers (*"Responsible for", "Helped with", "Worked on"*) with active alternatives (*"Assisted with", "Contributed to"*).
  - Preserves existing strong action verbs (*"Engineered", "Architected", "Developed"*) without prepending duplicate verbs.
  - Removes wordy phrases (*"in order to"* → *"to"*).
  - Applies strict no-op detection: if no meaningful improvement is generated, the bullet is marked as `no_suggestion`.

---

### API Service & Network Diagnostics
Implemented in [api.ts](file:///c:/Resume%20Bullet-Point%20Enhancer/src/services/api.ts):
- Normalizes base URLs using `VITE_API_BASE_URL` (defaulting to `http://127.0.0.1:8000`).
- Encapsulates errors inside a typed `ApiError` class distinguishing network connection failures (`isNetworkError: true`) from HTTP 4xx/5xx responses.
- Implements request timeouts using `AbortController` (6s for health checks, 120s for LLM inference).

---

### Evaluation Lab Page
Implemented in [EvaluationPage.tsx](file:///c:/Resume%20Bullet-Point%20Enhancer/src/pages/EvaluationPage.tsx):
- Queries `/api/evaluation/metrics` to load real metrics from the persisted `evaluation_report.json`.
- Displays top-level KPI cards: **Accuracy (75.7%)**, **Macro Precision (76.8%)**, **Macro Recall (76.1%)**, and **Macro F1 (75.2%)**.
- Displays an interactive **Confusion Matrix** with actual vs. predicted distribution across Weak, Adequate, and Strong tiers.
- Displays Per-Class breakdown tables (Precision, Recall, F1, Support).
- Provides a **"View Demo Data Preview"** toggle so users can inspect prototype layouts when the backend model artifact is not yet trained.

---

## 5. Backend Architecture (Everything Happening in the Background)

### Technology Stack & Configuration
- **FastAPI 0.115+**: High-performance asynchronous Python web framework.
- **Uvicorn**: ASGI web server running the application.
- **Pydantic v2**: Strict schema validation and serialization.
- **PyPDF 5.1+**: Text extraction from PDF documents.
- **python-docx 1.1+**: Reading DOCX documents and generating formatted Word resumes in memory.
- **scikit-learn 1.9+**: ML text classification pipeline (`TfidfVectorizer` + `LogisticRegression`).
- **joblib 1.4+**: Model artifact serialization.
- **httpx**: Asynchronous HTTP client for communicating with Ollama.

Configuration is centralized in [config.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/config.py):
```python
class Settings:
    APP_NAME: str = "BulletBoost API"
    APP_VERSION: str = "0.1.0"
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB limit
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_TIMEOUT_SECONDS: int = 180
    OLLAMA_KEEP_ALIVE: str = "5m"
    CLASSIFIER_PATH: str = "backend/models/bullet_classifier.joblib"
    EVALUATION_REPORT_PATH: str = "backend/models/evaluation_report.json"
    DATASET_PATH: str = "backend/data/bullet_quality_dataset.csv"
    CORS_ORIGIN_REGEX: str = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"
```

---

### Pydantic v2 Data Models
Defined in [models.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/models.py):
- `ResumeItem`: Individual bullet point or paragraph (`id`, `text`, `item_type`, `selected`).
- `ResumeSection`: Extracted section (`id`, `title`, `type`, `bullets`, `expanded`, `selected`).
- `ParseResumeResponse`: Structured output containing `sections`, `warnings`, and `metadata`.
- `EnhanceBulletsRequest`: Input payload with `bullets`, `target_role`, `writing_style`, `job_description`, and `supporting_facts`.
- `EnhancedBulletResponse`: Rewritten bullet result with `original`, `improved`, `explanation`, `warnings`, `status`, and `decision_reason`.
- `BulletClassificationInput` & `BulletClassificationResult`: ML inference input/output with `quality` (*weak/adequate/strong*) and `confidence` score.
- `ExportDocxRequest`: Contains original `sections` and list of `accepted_bullets` for Word substitution.

---

### FastAPI Router Layer
Mounted in [main.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/main.py):
1. **`health_router` (`GET /api/health`)**: Returns status `ok`, application name, and version.
2. **`parser_router` (`POST /api/parse-resume`, `POST /api/parse-resume-text`)**: Handles multipart uploads (.pdf, .docx, .txt) and pasted text.
3. **`ollama_router` (`GET /api/ollama/status`)**: Checks Ollama daemon availability without loading model weights.
4. **`enhancer_router` (`POST /api/enhance-bullets`)**: Orchestrates LLM rewriting, evidence validation, and corrective retries.
5. **`classifier_router` (`POST /api/classify-bullets`, `GET /api/evaluation/metrics`, `GET /api/classifier/status`)**: Runs scikit-learn batch predictions and delivers held-out test evaluation reports.
6. **`exporter_router` (`POST /api/export-docx`)**: Streams generated `.docx` binary files with appropriate MIME headers.

---

### Multi-Format Document Extraction Engine
Implemented in [extractors.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/services/extractors.py):
- **Payload Size Security**: `validate_file_size` enforces the 10 MB limit, throwing HTTP 413 if exceeded.
- **PDF Extraction (`extract_from_pdf`)**:
  - Verifies PDF magic bytes (`%PDF-`) to prevent file extension spoofing.
  - Extracts text across all pages using `pypdf.PdfReader`.
  - Flags image-only or scanned PDFs if extracted text length is under 30 characters.
- **DOCX Extraction (`extract_from_docx`)**:
  - Verifies OpenXML ZIP magic bytes (`PK\x03\x04`).
  - Iterates through `doc.paragraphs`, checking paragraph styles. If `style.name` indicates a list/bullet item, prepends a bullet marker if missing.
  - Extracts text from tables to capture tabular resume formats.
- **TXT Extraction (`extract_from_txt`)**:
  - Scans for null bytes (`\x00`) to reject binary files disguised as text.
  - Decodes with UTF-8, falling back gracefully to Latin-1.

---

### Rule-Based Section & Bullet Parser
Implemented in [section_parser.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/services/section_parser.py):
- **10 Known Section Types**: Maps header text against regular expressions for `summary`, `experience`, `internships`, `projects`, `education`, `skills`, `certifications`, `achievements`, `publications`, and `other`.
- **Date Pattern Exclusion**:
  ```python
  DATE_PATTERN = re.compile(
      r"(?:\b(?:Jan|Feb|Mar|...|December)\b|\b\d{4}\b)\s*(?:-|–|—|to)\s*(?:\b(?:Present|Current|...)\b|\b\d{4}\b)",
      re.IGNORECASE,
  )
  ```
  Lines matching date ranges (e.g., *"Software Engineer | June 2021 – Present"*) are classified as job headings or paragraphs rather than section headers.
- **Bullet Prefix Regex**:
  `r"^[\s]*(?:[•◦▪▫‣⁃∙·\*\-\+\–\—]|(?:\d+[\.\)]))\s+"` matches all unicode bullets, asterisks, dashes, and numbered lists.
- **Continuation Line Merging**: If a line does not start with a bullet marker and follows an active bullet, it is merged into the previous bullet with a single space.

---

### Hardened Prompt Builder & Anti-Injection Rules
Implemented in [prompt_builder.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/services/prompt_builder.py):
- Treats user inputs purely as **untrusted data** wrapped in structured JSON blocks.
- **Explicit Negative Rules**:
  - Zero metric invention: Prohibits percentages, multipliers, user counts, and dollar amounts.
  - Zero technology invention: Prohibits unmentioned frameworks or databases.
  - Zero outcome invention: Prohibits stock clauses (*"improving throughput by 25%"*, *"reducing system overhead"*).
  - Preserves factual ownership: Prohibits converting collaborative verbs (*"worked on"*, *"assisted"*) into executive verbs (*"architected"*, *"spearheaded"*).
- **Corrective Retry Prompt**:
  If the validator detects violations, `build_corrective_prompt` feeds the specific rejected claims back to the model with an explicit instruction to strip them.

---

### Ollama LLM Orchestration & Corrective Retries
Implemented in [ollama_service.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/services/ollama_service.py):
1. **Pre-flight Check**: Calls `/api/tags` to ensure Ollama is running and `llama3.2:3b` is available.
2. **Primary Inference**: Posts chat payload with `temperature: 0.2`, `format: "json"`, and `keep_alive: "5m"`.
3. **JSON Extraction**: Strips potential markdown code blocks (````json ... ````) and parses the `results` array.
4. **Validation Pass**: Validates every returned bullet using `validate_enhanced_bullet`.
5. **Targeted Corrective Retry**: If any candidate failed validation or returned identical text, executes **at most one targeted corrective prompt**.
6. **Safe Fallback & No-Op Detection**:
   - If an enhancement remains invalid after retry, the invalid draft is discarded. The original bullet is preserved with status `review_needed` and decision reason `unsupported_claim`.
   - If candidate text is identical or materially unchanged, `improved` is set to `None`, status to `no_suggestion`, and decision reason to `original_already_clear`.

---

### Deterministic Evidence Validator
Implemented in [validator.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/services/validator.py):

#### 1. Supporting Facts Scoping
Prevents facts from unrelated projects leaking into other bullets using domain clustering:
```python
DOMAIN_CLUSTERS = [
    {"payment", "payments", "transaction", "checkout", "billing", ...},
    {"backend", "microservice", "database", "sql", "postgres", "redis", ...},
    {"resnet", "resnet50", "image", "vision", "classification", "model", ...},
    {"celery", "redis", "kafka", "pipeline", "etl", "spark", ...},
    {"aws", "azure", "gcp", "docker", "kubernetes", "terraform", ...},
]
```
A sentence in `supporting_facts` is only permitted for a bullet if it shares direct vocabulary, technologies, or domain cluster overlap with that specific bullet.

#### 2. Metric Extraction & Comparison
Extracts numbers, percentages, monetary amounts, and time units:
```python
NUMBER_METRIC_PATTERN = re.compile(
    r"\b(?:\$?\d+(?:[\.,]\d+)?\s*(?:%|k|m|b|x|ms|s|h|sec|min|hours?|days?|months?|years?|fold)?|\d+\+)\b",
    re.IGNORECASE,
)
```
Any metric present in the improved bullet that cannot be found in the original text or scoped facts triggers an `unverified-metric` warning and invalidates the draft.

#### 3. Technology Keyword Extraction
Scans text against a dictionary of 60+ industry technologies (*Python, Docker, Kubernetes, Celery, Redis, PyTorch, React, etc.*). Any technology added by the model that was not in the original bullet or target role title is rejected with an `added-skill` warning.

#### 4. Leadership & Ownership Inflation Detection
Matches source text against modest indicators (*"helped"*, *"assisted"*, *"worked on"*) and proposed text against leadership terms (*"spearheaded"*, *"directed"*, *"architected"*, *"provisioned"*). Flags role inflation with a `vague-claim` warning.

#### 5. Grammatical Defect Detection
- **Duplicated Action Verbs**: Regex matches erroneous repetitions like *"Provisioned integrated"* or *"Spearheaded developed"*.
- **Punctuation Defects**: Regex catches artifacts like `.,`, `,.`, `..`, or dangling spaces before commas.

#### 6. No-Op Detection (`is_candidate_no_op`)
Detects when a proposed improvement offers no material value:
- Returns `True` if candidate text is empty or null.
- Returns `True` if strings are identical after whitespace collapsing.
- Returns `True` if strings are identical case-insensitively with trailing punctuation stripped.
- Returns `True` if the sequence of alphanumeric word tokens is 100% identical (formatting/punctuation-only changes).

---

### Custom ML Quality Classifier Pipeline
Implemented in [train_classifier.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/scripts/train_classifier.py) and [classifier_service.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/services/classifier_service.py):

#### Dataset
- Located at `backend/data/bullet_quality_dataset.csv`.
- Contains 183 hand-curated resume bullets labeled across three tiers:
  - **Weak (62 samples)**: Vague responsibilities, passive voice, missing context (e.g. *"Helped with various software tasks and bug fixes"*).
  - **Adequate (61 samples)**: Clear technical actions and tools, but lacking metric grounding or outcome context (e.g. *"Developed authentication microservice in Node.js with JWT"*).
  - **Strong (60 samples)**: Active verbs, specific technical architecture, metric-backed outcomes (e.g. *"Architected Redis caching layer, reducing database queries by 40% and improving response times"*).

#### Pipeline Architecture
```python
Pipeline([
    ("tfidf", TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        max_features=2500,
        min_df=1,
        token_pattern=r"(?u)\b\w+\b"
    )),
    ("clf", LogisticRegression(
        C=2.0,
        max_iter=1000,
        random_state=42,
        class_weight="balanced",
        solver="lbfgs"
    ))
])
```

#### Held-Out Evaluation Results (Seed 42)
Trained on 146 samples (80%), evaluated on 37 held-out test samples (20%):
- **Overall Accuracy**: **75.68%**
- **Macro Precision**: **76.81%**
- **Macro Recall**: **76.07%**
- **Macro F1-Score**: **75.21%**
- **Strong Tier Performance**:
  - Precision: **0.8000**
  - Recall: **1.0000 (100% recall — all 12 strong bullets correctly identified)**
  - F1-Score: **0.8889**
- **Confusion Matrix**:
  - Actual Weak (13): 8 predicted Weak, 5 predicted Adequate, 0 predicted Strong.
  - Actual Adequate (12): 1 predicted Weak, 8 predicted Adequate, 3 predicted Strong.
  - Actual Strong (12): 0 predicted Weak, 0 predicted Adequate, 12 predicted Strong.

#### Inference & Confidence Calculation
`classifier_service.py` caches the loaded pipeline singleton in memory. On batch calls:
- Extracts class probabilities using `pipeline.predict_proba(valid_texts)`.
- Confidence score is computed as `round(np.max(proba_row), 4)`.
- If confidence is below 0.50, the frontend displays an explicit disclaimer: *"Classification uncertain: probability distributed across multiple classes"*.

---

### In-Memory DOCX Document Exporter
Implemented in [exporter.py](file:///c:/Resume%20Bullet-Point%20Enhancer/backend/app/services/exporter.py):
- Constructs an OpenXML document in memory using `python-docx`.
- Applies standard executive 0.75-inch margins.
- Sets clean Calibri typography (18pt bold title, 11.5pt section headings in Forest Green `#2E7D5E` with single bottom border divider).
- **Selective Substitution**:
  ```python
  bullet_text = accepted_bullets_map.get(b.id, b.text).strip()
  ```
  Only bullets whose IDs exist in `accepted_bullets_map` are replaced with approved text. Unaccepted or rejected bullets retain their original text.
- Generates document binary directly into an `io.BytesIO` buffer with zero disk writes.

---

## 6. End-to-End Request Lifecycles & Execution Scenarios

### Scenario 1: Happy Path with Local Ollama
1. Candidate uploads `resume.pdf`.
2. Frontend posts multipart file to `/api/parse-resume`.
3. Backend extracts text via `pypdf`, parses sections and bullets, returns structured JSON.
4. Candidate selects Work Experience bullets, enters target role *"Senior Machine Learning Engineer"*, and clicks **Enhance**.
5. Frontend posts bullets to `/api/enhance-bullets`.
6. Backend checks Ollama connectivity, builds hardened prompt, calls local Ollama `/api/chat`.
7. Backend parses JSON response, runs evidence validation (all claims verified), and returns enhancements.
8. Frontend transitions to Review screen and submits bullets to `/api/classify-bullets`.
9. Classifier returns quality tiers and confidence scores for original and proposed text.
10. Candidate accepts enhancements and clicks **Export Resume (DOCX)**.
11. Backend constructs `.docx` substituting only accepted bullets and streams file to client.

---

### Scenario 2: Offline / Demo Mode Fallback
1. Candidate opens app without Ollama installed.
2. `EnhancementPreferences` displays amber notice: *"Ollama not running. Demo fallback active."*
3. Candidate clicks **Enhance Selected Bullets**.
4. Processing overlay appears with timer.
5. If backend is offline or candidate clicks **Skip Wait & Proceed Instantly**, `enhanceBulletsWithHeuristics` runs in the browser.
6. Weak openers are converted to active verbs without hallucinated metrics.
7. Candidate reviews suggestions and exports resume normally.

---

### Scenario 3: Hallucination Interception & Correction
1. Original bullet: *"Wrote Python scripts for data ingestion."*
2. LLM proposes: *"Architected automated data ingestion pipelines in Apache Spark, improving processing throughput by 35%."*
3. Validator intercepts:
   - `added-skill`: Apache Spark was not in source.
   - `unverified-metric`: 35% throughput gain was not in source.
   - `vague-claim`: "throughput improvement" was introduced.
4. Backend issues targeted corrective retry: *"Your previous rewrite was rejected for introducing Spark and 35% throughput. Strictly remove these claims."*
5. LLM retries: *"Engineered automated Python scripts for data ingestion."*
6. Validator verifies all claims are grounded. Validated enhancement is returned to user.
7. *(If the retry had failed, the backend would withhold the draft, set `improved: None`, and preserve original text with status `review_needed`).*

---

### Scenario 4: Inline Edit with Live ML Reclassification
1. Proposed bullet: *"Built customer service dashboard using React and Node.js."*
2. ML Badge: `Adequate (65% confidence)`.
3. Candidate clicks **Edit**, changes text to: *"Architected real-time customer service dashboard utilizing React and Node.js with modular component state management."*
4. Candidate clicks **Save**:
   - Client validates that no ungrounded metrics were introduced.
   - Client sends edit to `/api/classify-bullets`.
   - Backend evaluates text through TF-IDF + Logistic Regression pipeline.
   - Prediction returned: `Strong (86% confidence)`.
   - UI badge updates live from `Adequate` to `Strong`.

---

## 7. Automated Testing & Verification Suite (130 Tests)

BulletBoost includes **130 automated tests** ensuring end-to-end stability:

```
Automated Test Suite Breakdown:
├── Backend PyTest Tests: 105 passed (9.17s)
│   ├── test_api.py (Core endpoints & validation)
│   ├── test_classifier.py (Classifier pipeline, training, scoring)
│   ├── test_classifier_api.py (Classifier REST routes)
│   ├── test_connection_diagnostics.py (Launcher diagnostics & ports)
│   ├── test_enhancer_api.py (LLM endpoint & timeout handling)
│   ├── test_export.py (DOCX generation & substitutions)
│   ├── test_extractors.py (PDF, DOCX, TXT extraction)
│   ├── test_health.py (Health endpoint)
│   ├── test_p0_identical_text_regression.py (P0: No-op & anti-fake-uplift)
│   ├── test_p0_low_ml_confidence_pipeline.py (P0: Low confidence handling)
│   ├── test_prompt_builder.py (Prompt formatting & corrective retry)
│   ├── test_quality_regression.py (Anti-hallucination regressions)
│   ├── test_review_classifier_integration.py (Review & ML integration)
│   ├── test_section_parser.py (Section & bullet segmentation)
│   └── test_validator.py (Regex validation & domain clusters)
└── Frontend Node.js Tests: 25 passed (1.90s)
    ├── api_connection.test.ts (API URL normalization & network errors)
    └── p0_regression_tests.test.ts (No-op detection, review navigation, reducers)
```

### Key Regression Assertions Verified
- **No False Quality Uplift**: Identical text cannot trigger an artificial quality upgrade from Weak to Strong.
- **No Inconsequential Edits**: Whitespace, bullet markers (`•`, `-`), and trailing periods are detected as no-ops.
- **Real Grammar Changes Preserved**: Adding or modifying real content words is recognized as a genuine edit.
- **Zero Hallucinated Metrics**: New numbers or percentages are blocked unless present in source or scoped evidence.
- **Review List Navigation**: Accepting or rejecting automatically advances focus to the next pending item.

---

## 8. File-by-File Directory Guide

| File Path | Role and Responsibilities |
| :--- | :--- |
| `start_local.ps1` | PowerShell startup script: prerequisite checks, ML artifact verification, health polling, port conflict detection, background launch. |
| `backend/app/main.py` | FastAPI entrypoint, CORS configuration, router inclusion. |
| `backend/app/config.py` | Central configuration, file paths, model names, timeout settings. |
| `backend/app/models.py` | Pydantic v2 schemas for all requests, responses, and data models. |
| `backend/app/routers/health.py` | Liveness health check endpoint (`/api/health`). |
| `backend/app/routers/parser.py` | File upload and pasted text segmentation endpoints. |
| `backend/app/routers/ollama.py` | Ollama connectivity and model check endpoint. |
| `backend/app/routers/enhancer.py` | Ollama LLM bullet enhancement endpoint. |
| `backend/app/routers/classifier.py` | ML quality classification and evaluation metrics endpoints. |
| `backend/app/routers/exporter.py` | In-memory DOCX resume export endpoint. |
| `backend/app/services/extractors.py` | PDF, DOCX, and TXT parsing with magic byte validation. |
| `backend/app/services/section_parser.py` | Section classification, continuation line merging, bullet segmenter. |
| `backend/app/services/prompt_builder.py` | Anti-hallucination system prompt and corrective retry prompt builder. |
| `backend/app/services/validator.py` | Deterministic evidence validator, metric checker, and domain scoping. |
| `backend/app/services/ollama_service.py` | Ollama inference orchestrator with retries and safe fallbacks. |
| `backend/app/services/classifier_service.py` | Singleton service for scikit-learn batch quality predictions. |
| `backend/app/services/exporter.py` | Word document generator substituting only accepted bullets. |
| `backend/data/bullet_quality_dataset.csv` | Labeled training dataset (183 samples across Weak, Adequate, Strong). |
| `backend/models/bullet_classifier.joblib` | Serialized scikit-learn pipeline artifact. |
| `backend/models/evaluation_report.json` | Persisted held-out test split metrics and confusion matrix. |
| `backend/scripts/train_classifier.py` | Reproducible ML training pipeline script. |
| `src/context/AppContext.tsx` | Central React reducer, state management, and race condition protection. |
| `src/pages/LandingPage.tsx` | Marketing and entry landing page. |
| `src/pages/EnhancePage.tsx` | 4-step wizard container with progress overlay and skip button. |
| `src/pages/EvaluationPage.tsx` | Interactive Evaluation Lab with confusion matrix and KPI cards. |
| `src/pages/AboutPage.tsx` | Architecture overview and completed implementation status. |
| `src/components/enhance/ResumeImport.tsx` | File uploader and text paste component. |
| `src/components/enhance/SectionAnalysis.tsx` | Section hierarchy and granular bullet selection tree. |
| `src/components/enhance/EnhancementPreferences.tsx` | Target role, writing style, and supporting facts form. |
| `src/components/enhance/ResultsReview.tsx` | Sequential review workstation, inline editor, and export. |
| `src/services/api.ts` | Frontend HTTP client with network diagnostic error handling. |
| `src/services/heuristicEnhancer.ts` | Client-side rule-based enhancement fallback engine. |
| `src/utils/review.ts` | Sequential navigation algorithm (`findNextPendingBulletId`). |
| `src/types.ts` | TypeScript type declarations across frontend and backend models. |

---

*Document compiled for demonstration, architectural review, and engineering audit.*
