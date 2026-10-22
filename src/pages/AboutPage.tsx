import { Zap, Code2, Brain, ShieldCheck, FileText } from 'lucide-react';

export function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-charcoal mb-2">
        About BulletBoost
      </h1>
      <p className="text-sm text-muted mb-8 leading-relaxed">
        A resume enhancement tool that combines AI rewriting with quality
        classification and evidence validation.
      </p>

      <div className="space-y-6">
        {/* Architecture */}
        <InfoSection
          icon={<Code2 className="w-5 h-5 text-forest" />}
          title="Architecture"
        >
          <p>
            BulletBoost is designed as a decoupled system with a React/TypeScript
            frontend and a Python FastAPI backend (in development). The frontend
            manages the user workflow — resume import, section selection,
            preference configuration, and change review — while the backend will
            handle document parsing, LLM-based rewriting, and ML classification.
          </p>
        </InfoSection>

        {/* AI Rewriting */}
        <InfoSection
          icon={<Zap className="w-5 h-5 text-forest" />}
          title="AI-Powered Rewriting"
        >
          <p>
            The enhancement engine will use a large language model API to
            generate improved versions of resume bullet points, tailored to the
            user's target role, writing style, and optional job description.
            Improvements are always presented as suggestions — the original text
            is preserved until the user explicitly accepts a change.
          </p>
        </InfoSection>

        {/* ML Classifier */}
        <InfoSection
          icon={<Brain className="w-5 h-5 text-forest" />}
          title="Quality Classifier"
        >
          <p>
            A custom scikit-learn classifier is being trained to assess resume
            bullet quality across three tiers: Strong, Adequate, and Needs Work.
            The model uses TF-IDF features and a gradient-boosted ensemble.
            Training data, methodology, and evaluation metrics are available in
            the Evaluation Lab.
          </p>
        </InfoSection>

        {/* Evidence validation */}
        <InfoSection
          icon={<ShieldCheck className="w-5 h-5 text-forest" />}
          title="Evidence Validation"
        >
          <p>
            BulletBoost includes a validation layer that identifies potentially
            unsupported claims in enhanced bullets. When the AI generates
            specific metrics, skills, or responsibilities that weren't in the
            original text, these are flagged with clear warnings so the user
            can verify or adjust them.
          </p>
        </InfoSection>

        {/* Current status */}
        <InfoSection
          icon={<FileText className="w-5 h-5 text-forest" />}
          title="System Implementation & Architecture Status"
        >
          <p>
            BulletBoost is fully implemented with a connected React 19 frontend and
            Python FastAPI backend, running locally with full privacy. All features
            are backed by automated integration tests and verified pipelines.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <StatusItem label="Frontend UI & Workflow" status="complete" />
            <StatusItem label="Sequential Review Engine" status="complete" />
            <StatusItem label="Multi-Format Resume Parser" status="complete" />
            <StatusItem label="Ollama LLM Enhancement" status="complete" />
            <StatusItem label="Deterministic Validator" status="complete" />
            <StatusItem label="Scikit-Learn ML Classifier" status="complete" />
            <StatusItem label="Evaluation Lab & Metrics" status="complete" />
            <StatusItem label="In-Memory DOCX Exporter" status="complete" />
          </div>
        </InfoSection>
      </div>
    </div>
  );
}

function InfoSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-border rounded-lg p-5">
      <div className="flex items-center gap-2.5 mb-3">
        {icon}
        <h2 className="text-base font-semibold text-charcoal">{title}</h2>
      </div>
      <div className="text-sm text-muted leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}

function StatusItem({
  label,
  status,
}: {
  label: string;
  status: 'complete' | 'in-progress' | 'planned';
}) {
  const colors = {
    complete: 'bg-success text-white',
    'in-progress': 'bg-warning text-white',
    planned: 'bg-border-dark text-white',
  };
  const labels = {
    complete: 'Complete',
    'in-progress': 'In Progress',
    planned: 'Planned',
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-sage-light/50">
      <span className="text-charcoal">{label}</span>
      <span
        className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[status]}`}
      >
        {labels[status]}
      </span>
    </div>
  );
}
