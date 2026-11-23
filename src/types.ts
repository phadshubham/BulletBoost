// ── Resume data types ───────────────────────────────────────────────

export interface ResumeBullet {
  id: string;
  text: string;
  selected: boolean;
  itemType?: 'bullet' | 'paragraph';
}

export interface ResumeSection {
  id: string;
  title: string;
  type: SectionType;
  bullets: ResumeBullet[];
  expanded: boolean;
  selected: boolean;
}

export type SectionType =
  | 'summary'
  | 'experience'
  | 'internships'
  | 'projects'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'achievements'
  | 'publications'
  | 'other';

// ── Enhancement types ───────────────────────────────────────────────

export type WritingStyle = 'concise' | 'technical' | 'achievement';
export type EnhancementScope = 'sections' | 'bullets';

export interface EnhancementPreferences {
  targetRole: string;
  jobDescription: string;
  writingStyle: WritingStyle;
  scope: EnhancementScope;
}

// ── Review types ────────────────────────────────────────────────────

export type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'no_suggestion' | 'review_needed';
export type BulletQuality = 'weak' | 'adequate' | 'strong';
export type QualityLevel = 'strong' | 'adequate' | 'weak' | 'needs-work';
export type FilterStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'no_suggestion' | 'review_needed';

export type DecisionReason =
  | 'meaningful_suggestion'
  | 'original_already_clear'
  | 'unchanged_candidate'
  | 'superficial_change'
  | 'unsupported_claim'
  | 'generation_failed'
  | 'validation_failed'
  | 'classifier_uncertain';

export interface ValidationWarning {
  type: 'unverified-metric' | 'missing-evidence' | 'vague-claim' | 'added-skill';
  message: string;
}

export interface EnhancedBullet {
  id: string;
  originalBulletId: string;
  sectionTitle: string;
  original: string;
  improved: string | null;
  editedImproved?: string | null;
  explanation: string;
  quality?: QualityLevel | null;
  originalQuality?: BulletQuality | null;
  originalConfidence?: number | null;
  improvedQuality?: BulletQuality | null;
  improvedConfidence?: number | null;
  classifierUnavailable?: boolean;
  warnings: ValidationWarning[];
  alternativeTexts?: string[];
  missingEvidence?: string[];
  status: ReviewStatus;
  decisionReason?: DecisionReason | string | null;
  atsDelta?: number;
  atsBreakdown?: string[];
  styleVariation?: 'xyz' | 'executive' | 'technical';
  isOrphan?: boolean;
}

// ── Custom ML Classifier & Evaluation types ─────────────────────────

export interface BulletClassifyInput {
  id: string;
  text: string;
}

export interface BulletClassifyPrediction {
  id: string;
  text?: string | null;
  quality: BulletQuality | null;
  confidence: number | null;
  model_version?: string | null;
  status: 'success' | 'invalid_input' | 'model_unavailable' | 'error';
  error?: string | null;
}

export interface ClassifyBulletsResponse {
  predictions: BulletClassifyPrediction[];
  model_version: string;
  total_classified: number;
}

export interface ClassifierStatus {
  model_loaded: boolean;
  model_version?: string | null;
  scikit_learn_version?: string | null;
  model_path: string;
  dataset_available: boolean;
  dataset_path: string;
  evaluation_report_available: boolean;
  last_trained?: string | null;
}

export interface PerClassMetric {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

export interface DatasetMetadata {
  total_samples: number;
  train_samples: number;
  test_samples: number;
  test_split_ratio: number;
  overall_distribution: Record<string, number>;
  train_distribution: Record<string, number>;
  test_distribution: Record<string, number>;
  provenance: string;
  limitations: string;
}

export interface EvaluationMetricsDetails {
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  class_labels: string[];
  per_class: Record<string, PerClassMetric>;
  confusion_matrix: number[][];
}

export interface EvaluationMetricsResponse {
  available: boolean;
  model_name?: string | null;
  model_version?: string | null;
  model_architecture?: string | null;
  scikit_learn_version?: string | null;
  evaluation_timestamp?: string | null;
  random_seed?: number | null;
  dataset_metadata?: DatasetMetadata | null;
  metrics?: EvaluationMetricsDetails | null;
  status_message?: string | null;
}

// ── Ollama & Enhancement API types ──────────────────────────────────

export interface OllamaStatus {
  reachable: boolean;
  configured_model: string;
  model_installed: boolean;
  status_message: string;
  error_category?: 'service_unreachable' | 'model_missing' | 'none' | string | null;
  available_models: string[];
}

export interface SelectedBulletPayload {
  id: string;
  text: string;
  section_title?: string;
  section_type?: string;
}

export interface EnhanceBulletsRequest {
  bullets: SelectedBulletPayload[];
  target_role: string;
  job_description?: string;
  writing_style: WritingStyle;
  scope: EnhancementScope;
  supporting_facts?: string;
}

export interface EnhanceBulletsResponse {
  bullets: EnhancedBullet[];
  model_used: string;
  enhancement_time_ms: number;
  warnings: string[];
}

// ── Import types ────────────────────────────────────────────────────

export type ImportMethod = 'upload' | 'paste' | 'library';

export interface ImportedFile {
  name: string;
  size: number;
  type: string;
}

export interface ParseResumeResponse {
  filename?: string | null;
  sections: ResumeSection[];
  warnings: string[];
  metadata: {
    file_type: string;
    char_count: number;
    word_count: number;
    page_count?: number | null;
    extraction_method: string;
  };
}

// ── App state ───────────────────────────────────────────────────────

export type AppStep =
  | 'import'
  | 'analysis'
  | 'preferences'
  | 'results'
  | 'overview';

export interface BackendHealthState {
  status: 'checking' | 'connected' | 'disconnected';
  apiUrl: string;
  version?: string;
  error?: string;
  isNetworkError?: boolean;
  lastChecked?: number;
}

export interface AppState {
  step: AppStep;
  importMethod: ImportMethod;
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
  activeProjectId?: string | null;
  atsScore?: AtsResumeScore | null;
  projectList?: ProjectSummary[];
  isSavingProject?: boolean;
  lastSavedAt?: string | null;
}

// ── Export types ────────────────────────────────────────────────────

export interface AcceptedBulletExportItem {
  bullet_id: string;
  text: string;
}

export interface ExportDocxRequest {
  filename?: string;
  sections: ResumeSection[];
  accepted_bullets: AcceptedBulletExportItem[];
}


// ── ATS Scoring & History types ──────────────────────────────────────

export interface AtsResumeScore {
  overall_score: number;
  keyword_score: number;
  impact_score: number;
  brevity_score?: number;
  structure_score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  recommendations: string[];
  total_bullets_analyzed: number;
  buzzwords_detected?: string[];
  repetitive_verbs?: string[];
  xyz_compliance_rate?: number;
}

export interface AtsBulletScore {
  original_score: number;
  improved_score: number;
  delta: number;
  breakdown: string[];
  matched_keywords: string[];
}

export interface JdGapData {
  matched_skills: string[];
  missing_skills: string[];
  match_percentage: number;
  recommendations: string[];
}

export interface BulletRevisionItem {
  id: string;
  bullet_id: string;
  section_title: string;
  original_text: string;
  current_text: string;
  status: string;
  decision_reason?: string | null;
  ats_delta?: number | null;
  variation_angle?: string | null;
  created_at: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  target_role: string;
  writing_style: string;
  bullet_count: number;
  accepted_count?: number;
  rejected_count?: number;
  pending_count?: number;
  ats_score?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail {
  id: string;
  title: string;
  target_role: string;
  job_description: string;
  writing_style: string;
  supporting_facts: string;
  filename: string;
  raw_text?: string;
  sections: ResumeSection[];
  enhanced_bullets?: EnhancedBullet[];
  revisions: BulletRevisionItem[];
  created_at: string;
  updated_at: string;
}

export interface UploadedResumeItem {
  id: string;
  project_id: string;
  filename: string;
  file_type: string;
  bullet_count: number;
  section_count: number;
  sections: ResumeSection[];
  raw_text?: string;
  created_at: string;
  uploaded_at?: string;
}
