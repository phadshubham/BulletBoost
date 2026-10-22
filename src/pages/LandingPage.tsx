import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  FileText,
  Target,
  ShieldCheck,
  Sparkles,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero */}
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-charcoal leading-tight tracking-tight">
            Make every bullet point
            <br />
            <span className="text-forest">work harder for you</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-xl mx-auto leading-relaxed">
            BulletBoost analyzes your resume, suggests role-specific improvements,
            and flags unverified claims — so your experience speaks with clarity and evidence.
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              onClick={() => navigate('/enhance')}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Improve My Resume
            </Button>
          </div>
        </div>
      </section>

      {/* Before/After Preview */}
      <section className="pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before */}
            <div className="bg-white border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-error" />
                <span className="text-xs font-medium text-muted uppercase tracking-wider">
                  Before
                </span>
              </div>
              <div className="space-y-3">
                <BulletRow
                  text="Worked on improving the performance of the search functionality."
                  variant="before"
                />
                <BulletRow
                  text="Participated in code reviews and helped onboard new team members."
                  variant="before"
                />
                <BulletRow
                  text="Developed and maintained several customer-facing features for the main product."
                  variant="before"
                />
              </div>
            </div>

            {/* After */}
            <div className="bg-white border border-green-200 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs font-medium text-muted uppercase tracking-wider">
                  After
                </span>
              </div>
              <div className="space-y-3">
                <BulletRow
                  text="Optimized search query performance by implementing database indexing and caching strategies, reducing average response time from 1.2s to 180ms."
                  variant="after"
                />
                <BulletRow
                  text="Reviewed 50+ pull requests per quarter and mentored 3 new engineers through structured onboarding."
                  variant="after"
                />
                <BulletRow
                  text="Developed and shipped 12 customer-facing features for the core SaaS product, contributing to a product line that served 15,000+ MAU."
                  variant="after"
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-muted-light mt-3">
            Sample improvements shown for illustration. All metrics in enhanced bullets
            require verification.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-white border-y border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-charcoal text-center mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StepCard
              number={1}
              icon={<FileText className="w-5 h-5" />}
              title="Upload your resume"
              description="Import a PDF or DOCX, or paste your resume text directly."
            />
            <StepCard
              number={2}
              icon={<Target className="w-5 h-5" />}
              title="Choose what to improve"
              description="Select specific sections and bullet points. Skip what's already strong."
            />
            <StepCard
              number={3}
              icon={<Sparkles className="w-5 h-5" />}
              title="Get tailored suggestions"
              description="Receive role-specific improvements with explanations and quality scores."
            />
            <StepCard
              number={4}
              icon={<CheckCircle className="w-5 h-5" />}
              title="Review and accept"
              description="Accept, reject, or edit each suggestion. Nothing changes without your approval."
            />
          </div>
        </div>
      </section>

      {/* Evidence-first approach */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4 bg-white border border-border rounded-lg p-6">
            <div className="w-10 h-10 rounded-md bg-sage flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-forest" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-charcoal mb-1.5">
                Evidence-first approach
              </h3>
              <p className="text-sm text-muted leading-relaxed mb-3">
                BulletBoost does not fabricate accomplishments. When the AI
                suggests quantified improvements, each metric is flagged as
                unverified so you can replace it with your actual data.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <span className="text-muted">
                    Generated metrics are clearly labeled as unverified
                  </span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" />
                  <span className="text-muted">
                    Original text preserved until you explicitly accept changes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Helper components ───────────────────────────────────────────────

function BulletRow({
  text,
  variant,
}: {
  text: string;
  variant: 'before' | 'after';
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`
          mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0
          ${variant === 'before' ? 'bg-border-dark' : 'bg-forest'}
        `}
      />
      <p
        className={`
          text-sm leading-relaxed
          ${variant === 'before' ? 'text-muted' : 'text-charcoal'}
        `}
      >
        {text}
      </p>
    </div>
  );
}

function StepCard({
  number,
  icon,
  title,
  description,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-sage mb-3">
        <span className="text-forest">{icon}</span>
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-forest text-white text-xs font-medium flex items-center justify-center">
          {number}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-charcoal mb-1">{title}</h3>
      <p className="text-xs text-muted leading-relaxed">{description}</p>
    </div>
  );
}
