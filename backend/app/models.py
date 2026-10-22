from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class ResumeItem(BaseModel):
    """An individual extracted item (bullet point or paragraph) within a section."""
    id: str = Field(..., description="Unique stable identifier for the bullet item")
    text: str = Field(..., description="Original, unenhanced text of the bullet point")
    item_type: Literal["bullet", "paragraph"] = Field(
        default="bullet",
        description="Type of content: bullet or paragraph"
    )
    selected: bool = Field(
        default=True,
        description="Whether this bullet is selected for enhancement by default"
    )


class ResumeSection(BaseModel):
    """A detected section in the parsed resume."""
    id: str = Field(..., description="Unique stable identifier for the section")
    title: str = Field(..., description="Extracted or inferred section heading title")
    type: str = Field(
        ...,
        description="Standardized section category: summary, experience, internships, projects, education, skills, certifications, achievements, publications, or other"
    )
    bullets: List[ResumeItem] = Field(
        default_factory=list,
        description="List of bullet items or paragraphs in this section"
    )
    expanded: bool = Field(
        default=True,
        description="UI state: whether section is expanded"
    )
    selected: bool = Field(
        default=True,
        description="UI state: whether section is selected"
    )


class ExtractionMetadata(BaseModel):
    """Metadata regarding the text extraction process."""
    file_type: str = Field(..., description="Source format: pdf, docx, txt, or pasted_text")
    char_count: int = Field(..., description="Total characters extracted")
    word_count: int = Field(..., description="Total words extracted")
    page_count: Optional[int] = Field(None, description="Number of pages if applicable")
    extraction_method: str = Field(..., description="Tool used: pypdf, python-docx, or plain_text")


class ParseResumeResponse(BaseModel):
    """Structured response returned by parse endpoints."""
    filename: Optional[str] = Field(None, description="Original uploaded filename or identifier")
    sections: List[ResumeSection] = Field(..., description="Structured resume sections with bullets")
    warnings: List[str] = Field(default_factory=list, description="Parsing warnings (e.g. scanned PDF warning)")
    metadata: ExtractionMetadata = Field(..., description="Details about the extraction process")


class ParseTextRequest(BaseModel):
    """Request payload for pasted text parsing."""
    text: str = Field(default="", description="Raw pasted resume text")
    filename: Optional[str] = Field(default="pasted_resume.txt", description="Optional display filename")


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = "ok"
    app: str = "BulletBoost API"
    version: str = "0.1.0"


# ── Ollama & Enhancement Models ──────────────────────────────────────────


class OllamaStatusResponse(BaseModel):
    """Status of the local Ollama LLM service."""
    reachable: bool = Field(..., description="Whether Ollama HTTP API is reachable")
    configured_model: str = Field(..., description="Name of the configured model")
    model_installed: bool = Field(..., description="Whether configured model is downloaded locally")
    status_message: str = Field(..., description="Human-readable status summary")
    error_category: Optional[str] = Field(None, description="Safe error category: service_unreachable, model_missing, etc.")
    available_models: List[str] = Field(default_factory=list, description="List of local models discovered")


class SelectedBullet(BaseModel):
    """Input bullet selected by the user for enhancement."""
    id: str = Field(..., description="Stable ID of the bullet point")
    text: str = Field(..., description="Original raw bullet text")
    section_title: str = Field(..., description="Title of the section containing this bullet")
    section_type: str = Field(default="experience", description="Type category of the section")


class EnhanceBulletsRequest(BaseModel):
    """Request payload for enhancing selected resume bullets."""
    bullets: List[SelectedBullet] = Field(..., min_length=1, max_length=50, description="List of selected bullets to enhance")
    target_role: str = Field(..., min_length=1, description="Target job title or role")
    job_description: Optional[str] = Field(default="", description="Optional target job description")
    writing_style: Literal["concise", "technical", "achievement"] = Field(
        default="achievement",
        description="Desired editorial style"
    )
    scope: str = Field(default="bullets", description="Enhancement scope")
    supporting_facts: Optional[str] = Field(default="", description="Optional user-supplied background facts")


class ValidationWarningModel(BaseModel):
    """Evidence warning flagged by the truthfulness validation layer."""
    type: Literal["unverified-metric", "missing-evidence", "vague-claim", "added-skill"]
    message: str


class EnhancedBulletResponse(BaseModel):
    """Enhanced bullet returned to the frontend."""
    id: str = Field(..., description="Unique ID for this enhanced result item")
    original_bullet_id: str = Field(..., description="Original bullet ID mapping")
    section_title: str = Field(..., description="Section title")
    original: str = Field(..., description="Original bullet text")
    improved: Optional[str] = Field(None, description="Model-improved bullet text, or None if no suggestion needed")
    alternative_texts: List[str] = Field(default_factory=list, description="Alternative variations if generated")
    explanation: str = Field(..., description="User-facing explanation of editorial improvements")
    quality: Optional[str] = Field(None, description="Quality classification (None if ML classifier not connected)")
    warnings: List[ValidationWarningModel] = Field(default_factory=list, description="Validation layer notices")
    missing_evidence: List[str] = Field(default_factory=list, description="Specific metrics or details missing from original")
    status: Literal["pending", "accepted", "rejected", "no_suggestion", "review_needed"] = Field(
        default="pending", description="Initial review status"
    )
    decision_reason: Optional[
        Literal[
            "meaningful_suggestion",
            "original_already_clear",
            "unchanged_candidate",
            "superficial_change",
            "unsupported_claim",
            "generation_failed",
            "validation_failed",
            "classifier_uncertain",
        ]
    ] = Field(None, description="Internal structured reason code for the enhancement decision")


class EnhanceBulletsResponse(BaseModel):
    """Response returned by /api/enhance-bullets."""
    bullets: List[EnhancedBulletResponse] = Field(..., description="List of enhanced bullet items")
    model_used: str = Field(..., description="LLM model identifier used for generation")
    enhancement_time_ms: float = Field(..., description="Inference execution duration in milliseconds")
    warnings: List[str] = Field(default_factory=list, description="General operational notices")


# ── Custom ML Resume Bullet Classifier Models ─────────────────────────────


class BulletClassificationInput(BaseModel):
    """Single bullet point submitted for ML quality category evaluation."""
    id: str = Field(..., min_length=1, max_length=200, description="Stable identifier of the bullet point")
    text: str = Field(..., description="Text of the bullet point to evaluate")


class BulletClassificationResult(BaseModel):
    """ML prediction result mapped to an input bullet identifier."""
    id: str = Field(..., description="Original bullet identifier matching input")
    text: Optional[str] = Field(None, description="The exact text version evaluated")
    quality: Optional[Literal["weak", "adequate", "strong"]] = Field(
        None,
        description="Predicted quality category based on trained rubric: weak, adequate, or strong"
    )
    confidence: Optional[float] = Field(
        None,
        description="Model prediction confidence score (0.0 to 1.0) derived from classifier probability"
    )
    model_version: Optional[str] = Field(None, description="Classifier model artifact version")
    status: Literal["success", "invalid_input", "model_unavailable", "error"] = Field(
        default="success",
        description="Prediction outcome status"
    )
    error: Optional[str] = Field(None, description="Error explanation if prediction could not be produced")


class ClassifyBulletsRequest(BaseModel):
    """Request payload for batch bullet classification."""
    bullets: List[BulletClassificationInput] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Array of bullet items to evaluate (max 100 per request)"
    )


class ClassifyBulletsResponse(BaseModel):
    """Response returned by POST /api/classify-bullets."""
    predictions: List[BulletClassificationResult] = Field(..., description="List of classification predictions")
    model_version: str = Field(..., description="Classifier version used")
    total_classified: int = Field(..., description="Count of successfully evaluated bullets")


class ClassifierStatusResponse(BaseModel):
    """Status of the ML classifier model artifact and dataset."""
    model_loaded: bool = Field(..., description="Whether the classifier artifact is loaded in memory")
    model_version: Optional[str] = Field(None, description="Current loaded model version")
    scikit_learn_version: Optional[str] = Field(None, description="scikit-learn version used during training")
    model_path: str = Field(..., description="Path to the model artifact")
    dataset_available: bool = Field(..., description="Whether training dataset exists on disk")
    dataset_path: str = Field(..., description="Path to training dataset")
    evaluation_report_available: bool = Field(..., description="Whether evaluation metrics report exists")
    last_trained: Optional[str] = Field(None, description="ISO timestamp of last evaluation/training run")


class PerClassMetric(BaseModel):
    """Precision, recall, and F1-score for a single quality class."""
    precision: float
    recall: float
    f1_score: float
    support: int


class DatasetMetadata(BaseModel):
    """Provenance and split metadata for the labeled training dataset."""
    total_samples: int
    train_samples: int
    test_samples: int
    test_split_ratio: float
    overall_distribution: Dict[str, int]
    train_distribution: Dict[str, int]
    test_distribution: Dict[str, int]
    provenance: str
    limitations: str


class MetricsDetails(BaseModel):
    """Comprehensive evaluation metrics on the held-out test split."""
    accuracy: float
    macro_precision: float
    macro_recall: float
    macro_f1: float
    class_labels: List[str]
    per_class: Dict[str, PerClassMetric]
    confusion_matrix: List[List[int]]


class EvaluationMetricsResponse(BaseModel):
    """Response returned by GET /api/evaluation/metrics."""
    available: bool = Field(..., description="Whether real evaluation metrics are available")
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    model_architecture: Optional[str] = None
    scikit_learn_version: Optional[str] = None
    evaluation_timestamp: Optional[str] = None
    random_seed: Optional[int] = None
    dataset_metadata: Optional[DatasetMetadata] = None
    metrics: Optional[MetricsDetails] = None
    status_message: Optional[str] = None


# ── Resume Export Models ──────────────────────────────────────────────────


class AcceptedBulletExportItem(BaseModel):
    """An accepted bullet revision to substitute into the exported document."""
    bullet_id: str = Field(..., description="Original bullet identifier to replace")
    text: str = Field(..., description="Approved enhanced text to substitute")


class ExportDocxRequest(BaseModel):
    """Payload for generating a downloadable DOCX resume."""
    filename: Optional[str] = Field(default="enhanced_resume.docx", description="Target output filename")
    sections: List[ResumeSection] = Field(default_factory=list, description="Original parsed resume sections")
    accepted_bullets: List[AcceptedBulletExportItem] = Field(
        default_factory=list,
        description="List of user-accepted bullet point replacements"
    )


