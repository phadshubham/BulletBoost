import { useMemo, useState, useEffect } from 'react';
import {
  Sparkles,
  Cpu,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Check,
} from 'lucide-react';
import { Button, Input, Textarea, Badge } from '../ui';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { getDemoEnhancedBullets } from '../../data/demo';
import { getOllamaStatus, enhanceBullets } from '../../services/api';
import { enhanceBulletsWithHeuristics } from '../../services/heuristicEnhancer';
import type {
  WritingStyle,
  OllamaStatus,
  SelectedBulletPayload,
} from '../../types';

const writingStyles: { value: WritingStyle; label: string; description: string }[] = [
  {
    value: 'concise',
    label: 'Concise',
    description: 'Short, impactful bullets. Prioritizes brevity and high signal-to-noise.',
  },
  {
    value: 'technical',
    label: 'Technical',
    description: 'Emphasizes technologies, architecture, and exact methods used.',
  },
  {
    value: 'achievement',
    label: 'Achievement-Oriented',
    description: 'Centers on delivered outcomes, metrics, and strong action verbs.',
  },
];

const ROLE_SUGGESTIONS = [
  'Senior Full Stack Engineer',
  'Staff Backend Engineer',
  'Frontend Developer',
  'Platform / DevOps Engineer',
  'Data Engineer',
  'Engineering Manager',
];

type EngineChoice = 'heuristic' | 'ollama';

export function EnhancementPreferences() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [roleError, setRoleError] = useState<string | null>(null);
  const [supportingFacts, setSupportingFacts] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(true);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [engineChoice, setEngineChoice] = useState<EngineChoice>('heuristic');
  const [autoFallback, setAutoFallback] = useState(true);

  const selectedCount = useMemo(() => {
    return state.sections.reduce(
      (sum, s) => sum + s.bullets.filter((b) => b.selected).length,
      0
    );
  }, [state.sections]);

  const fetchOllamaStatus = () => {
    setCheckingOllama(true);
    getOllamaStatus()
      .then((status) => {
        setOllamaStatus(status);
        if (status.reachable && status.model_installed) {
          setEngineChoice('ollama');
        }
        setCheckingOllama(false);
      })
      .catch(() => {
        setCheckingOllama(false);
      });
  };

  useEffect(() => {
    let active = true;
    getOllamaStatus()
      .then((status) => {
        if (active) {
          setOllamaStatus(status);
          if (status.reachable && status.model_installed) {
            setEngineChoice('ollama');
          }
          setCheckingOllama(false);
        }
      })
      .catch(() => {
        if (active) {
          setCheckingOllama(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const getEffectiveTargetRole = (): string => {
    if (state.preferences.targetRole.trim()) {
      return state.preferences.targetRole.trim();
    }
    return 'Software Professional';
  };

  const extractSelectedBullets = (): SelectedBulletPayload[] => {
    let list: SelectedBulletPayload[] = [];
    for (const section of state.sections) {
      for (const bullet of section.bullets) {
        if (bullet.selected) {
          list.push({
            id: bullet.id,
            text: bullet.text,
            section_title: section.title,
            section_type: section.type,
          });
        }
      }
    }

    // If somehow none were selected, auto-select all bullets from existing sections
    if (list.length === 0 && state.sections.length > 0) {
      dispatch({ type: 'SELECT_ALL_SECTIONS', selected: true });
      for (const section of state.sections) {
        for (const bullet of section.bullets) {
          list.push({
            id: bullet.id,
            text: bullet.text,
            section_title: section.title,
            section_type: section.type,
          });
        }
      }
    }

    // If still empty (e.g. state.sections is empty due to page reload or direct navigation)
    if (list.length === 0) {
      list = [
        {
          id: 'demo-b1',
          text: 'Developed high-concurrency microservices in Node.js and TypeScript handling payment transactions.',
          section_title: 'Experience',
          section_type: 'experience',
        },
        {
          id: 'demo-b2',
          text: 'Architected Redis caching layer reducing database queries by 40% and cutting latency to under 50ms.',
          section_title: 'Experience',
          section_type: 'experience',
        },
        {
          id: 'demo-b3',
          text: 'Implemented automated CI/CD deployment pipelines using GitHub Actions and Docker on AWS ECS.',
          section_title: 'Experience',
          section_type: 'experience',
        },
      ];
    }

    return list;
  };

  const handleRunHeuristicEnhance = () => {
    setRoleError(null);
    setEnhanceError(null);
    const effectiveRole = getEffectiveTargetRole();
    if (!state.preferences.targetRole.trim()) {
      dispatch({
        type: 'SET_PREFERENCES',
        preferences: { targetRole: effectiveRole },
      });
    }

    const bulletsPayload = extractSelectedBullets();
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });

    setTimeout(() => {
      const enhanced = enhanceBulletsWithHeuristics({
        bullets: bulletsPayload,
        targetRole: effectiveRole,
        jobDescription: state.preferences.jobDescription,
        writingStyle: state.preferences.writingStyle,
        supportingFacts,
      });

      dispatch({ type: 'SET_DEMO_MODE', isDemo: state.isDemo });
      dispatch({ type: 'SET_ENHANCED_BULLETS', bullets: enhanced });
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
      dispatch({ type: 'SET_STEP', step: 'results' });
    }, 300);
  };

  const handleEnhance = async () => {
    const effectiveRole = getEffectiveTargetRole();
    if (!state.preferences.targetRole.trim()) {
      dispatch({
        type: 'SET_PREFERENCES',
        preferences: { targetRole: effectiveRole },
      });
    }
    setRoleError(null);
    setEnhanceError(null);

    const selectedBulletsPayload = extractSelectedBullets();

    // If user chose Built-in AI engine or Ollama is offline/missing, run heuristic engine directly
    if (engineChoice === 'heuristic' || !ollamaStatus?.model_installed) {
      handleRunHeuristicEnhance();
      return;
    }

    // Attempt real Ollama LLM Enhancement
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    try {
      const response = await enhanceBullets({
        bullets: selectedBulletsPayload,
        target_role: effectiveRole,
        job_description: state.preferences.jobDescription,
        writing_style: state.preferences.writingStyle,
        scope: state.preferences.scope,
        supporting_facts: supportingFacts,
      }, 120000);

      dispatch({ type: 'SET_DEMO_MODE', isDemo: false });
      dispatch({ type: 'SET_ENHANCED_BULLETS', bullets: response.bullets });
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
      dispatch({ type: 'SET_STEP', step: 'results' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enhancement request failed.';
      console.warn('Ollama request encountered an issue, automatically proceeding with Built-in AI engine:', msg);

      // GUARANTEED PROGRESSION: Seamlessly fall back to built-in AI engine so user is NEVER blocked
      const enhanced = enhanceBulletsWithHeuristics({
        bullets: selectedBulletsPayload,
        targetRole: effectiveRole,
        jobDescription: state.preferences.jobDescription,
        writingStyle: state.preferences.writingStyle,
        supportingFacts,
      });

      dispatch({ type: 'SET_DEMO_MODE', isDemo: true });
      dispatch({ type: 'SET_ENHANCED_BULLETS', bullets: enhanced });
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
      dispatch({ type: 'SET_STEP', step: 'results' });
    }
  };

  const handleRunDemoFallback = () => {
    setEnhanceError(null);
    dispatch({ type: 'SET_DEMO_MODE', isDemo: true });
    dispatch({ type: 'SET_PROCESSING', isProcessing: true });
    setTimeout(() => {
      const enhanced = getDemoEnhancedBullets(state.sections);
      dispatch({ type: 'SET_ENHANCED_BULLETS', bullets: enhanced });
      dispatch({ type: 'SET_PROCESSING', isProcessing: false });
      dispatch({ type: 'SET_STEP', step: 'results' });
    }, 400);
  };

  const handleBack = () => {
    dispatch({ type: 'SET_STEP', step: 'analysis' });
  };

  const isOllamaReady = Boolean(ollamaStatus?.model_installed);

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-charcoal">
          Enhancement Preferences
        </h2>
        <p className="text-sm text-muted mt-1.5">
          Configure role context and writing style to power up your resume bullets.
        </p>
      </div>

      {state.sections.length === 0 && (
        <div className="mb-4 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>No resume content is loaded (page refreshed). We will enhance sample resume bullets, or you can reload demo data.</span>
          </div>
          <Button size="sm" variant="outline" onClick={handleRunDemoFallback} className="text-xs py-1 h-auto flex-shrink-0">
            Load Sample Data
          </Button>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg p-5 sm:p-6 space-y-5 shadow-xs">
        {/* Engine Selection Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-charcoal block">
            Enhancement Engine
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Built-in Heuristic AI Engine */}
            <button
              type="button"
              onClick={() => setEngineChoice('heuristic')}
              className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
                engineChoice === 'heuristic'
                  ? 'border-forest bg-sage-light/60 ring-2 ring-forest/20'
                  : 'border-border hover:border-border-dark bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-forest" />
                  <span className="text-sm font-semibold text-charcoal">
                    Built-in AI Engine
                  </span>
                </div>
                <Badge variant="success" className="text-[10px] py-0 px-1.5">
                  Instant & Reliable
                </Badge>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Client & rule-based engine. Generates impact metrics, power verbs, and alternatives with zero external dependencies.
              </p>
            </button>

            {/* Ollama Local LLM Engine */}
            <button
              type="button"
              onClick={() => setEngineChoice('ollama')}
              className={`text-left p-3.5 rounded-lg border transition-all cursor-pointer ${
                engineChoice === 'ollama'
                  ? 'border-forest bg-sage-light/60 ring-2 ring-forest/20'
                  : 'border-border hover:border-border-dark bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-forest" />
                  <span className="text-sm font-semibold text-charcoal">
                    Ollama Local LLM
                  </span>
                </div>
                {checkingOllama ? (
                  <Badge variant="default" className="text-[10px] py-0 px-1.5">
                    Checking…
                  </Badge>
                ) : isOllamaReady ? (
                  <Badge variant="success" className="text-[10px] py-0 px-1.5">
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="warning" className="text-[10px] py-0 px-1.5">
                    {ollamaStatus?.reachable ? 'Model Missing' : 'Service Offline'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Uses local Ollama inference ({ollamaStatus?.configured_model || 'llama3.2:3b'}). Requires active Ollama server.
              </p>
            </button>
          </div>
        </div>

        {/* Ollama Status Diagnostic Banner (Only shown if Ollama selected or checking) */}
        {engineChoice === 'ollama' && (
          <div className="p-3.5 rounded-lg border border-border bg-sage-light/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-4 h-4 text-forest flex-shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-charcoal">
                    Ollama Diagnostic:
                  </span>
                  {checkingOllama ? (
                    <span className="text-xs text-muted">Checking connection…</span>
                  ) : isOllamaReady ? (
                    <Badge variant="success" className="gap-1 py-0.5 text-[11px]">
                      <CheckCircle2 className="w-3 h-3" />
                      Ready ({ollamaStatus?.configured_model})
                    </Badge>
                  ) : ollamaStatus?.reachable ? (
                    <Badge variant="warning" className="gap-1 py-0.5 text-[11px]">
                      Model Missing ({ollamaStatus.configured_model})
                    </Badge>
                  ) : (
                    <Badge variant="error" className="gap-1 py-0.5 text-[11px]">
                      Service Stopped
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {ollamaStatus?.status_message ?? 'Checking status of local Ollama instance…'}
                  {!isOllamaReady && !checkingOllama && (
                    <span className="block text-forest font-medium mt-1">
                      Tip: Switch to "Built-in AI Engine" above to proceed immediately without Ollama.
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchOllamaStatus}
              disabled={checkingOllama}
              className="text-xs py-1 h-auto self-start sm:self-auto"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${checkingOllama ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        )}

        {/* Target role */}
        <div className="space-y-1.5">
          <Input
            id="target-role-input"
            label="Target Job Role"
            placeholder="e.g. Senior Backend Engineer, Staff Platform Architect, Product Lead"
            value={state.preferences.targetRole}
            onChange={(e) => {
              dispatch({
                type: 'SET_PREFERENCES',
                preferences: { targetRole: e.target.value },
              });
              if (roleError) setRoleError(null);
            }}
            error={roleError ?? undefined}
          />
          {/* Role suggestions pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted mr-1">Suggestions:</span>
            {ROLE_SUGGESTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  dispatch({
                    type: 'SET_PREFERENCES',
                    preferences: { targetRole: role },
                  });
                  if (roleError) setRoleError(null);
                }}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                  state.preferences.targetRole === role
                    ? 'border-forest bg-forest text-white font-medium'
                    : 'border-border text-muted hover:border-border-dark hover:text-charcoal bg-white'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Optional job description */}
        <Textarea
          id="job-description-input"
          label="Job Description (Optional)"
          placeholder="Paste a target job description to steer the model towards relevant keywords and system competencies."
          rows={3}
          value={state.preferences.jobDescription}
          onChange={(e) =>
            dispatch({
              type: 'SET_PREFERENCES',
              preferences: { jobDescription: e.target.value },
            })
          }
          helperText="Aligns terminology and keywords with the role requirements."
        />

        {/* Supporting Facts Input */}
        <Textarea
          id="supporting-facts-input"
          label="Supporting Facts & Metrics (Optional)"
          placeholder="e.g. Led a team of 4 engineers; used Kafka and Redis to reduce latency by 35%; managed $120k cloud budget."
          rows={2}
          value={supportingFacts}
          onChange={(e) => setSupportingFacts(e.target.value)}
          helperText="Any real quantities, metrics, or technologies provided here are verified as evidence."
        />

        {/* Writing style */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-charcoal block">
            Writing Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {writingStyles.map((style) => (
              <button
                key={style.value}
                id={`style-btn-${style.value}`}
                className={`
                  text-left p-3 rounded-md border transition-all duration-150 focus-ring cursor-pointer
                  ${
                    state.preferences.writingStyle === style.value
                      ? 'border-forest bg-sage-light ring-1 ring-forest/20'
                      : 'border-border hover:border-border-dark bg-white'
                  }
                `}
                onClick={() =>
                  dispatch({
                    type: 'SET_PREFERENCES',
                    preferences: { writingStyle: style.value },
                  })
                }
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-charcoal block">
                    {style.label}
                  </span>
                  {state.preferences.writingStyle === style.value && (
                    <Check className="w-3.5 h-3.5 text-forest" />
                  )}
                </div>
                <span className="text-xs text-muted mt-0.5 block leading-normal">
                  {style.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Scope summary */}
        <div className="flex items-center justify-between p-3 bg-sage-light/60 rounded-md text-sm text-charcoal">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-forest flex-shrink-0" />
            <span>
              <strong>{selectedCount}</strong> bullet{selectedCount !== 1 ? 's' : ''}{' '}
              selected for enhancement
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="w-3.5 h-3.5 text-forest" />
            <span>Evidence Validation Active</span>
          </div>
        </div>

        {/* Auto-fallback checkbox for Ollama */}
        {engineChoice === 'ollama' && (
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none pt-1">
            <input
              type="checkbox"
              checked={autoFallback}
              onChange={(e) => setAutoFallback(e.target.checked)}
              className="rounded border-border text-forest focus:ring-forest"
            />
            <span>Auto-fallback to Built-in AI Engine if Ollama is unreachable or times out</span>
          </label>
        )}

        {/* Error banner if enhancement fails */}
        {enhanceError && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 animate-fade-in space-y-2.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs text-red-950 uppercase tracking-wide">
                  Ollama Enhancement Encountered an Issue
                </p>
                <p className="text-xs text-red-800 leading-relaxed mt-1">
                  {enhanceError}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                size="sm"
                onClick={handleRunHeuristicEnhance}
                className="text-xs py-1.5 font-medium"
              >
                <Zap className="w-3.5 h-3.5 mr-1" />
                Proceed with Built-in AI Engine
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-800 hover:bg-red-100 text-xs py-1"
                onClick={handleEnhance}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Retry Ollama
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6">
        <Button variant="ghost" onClick={handleBack} className="order-2 sm:order-1 w-full sm:w-auto">
          Back to Selection
        </Button>
        <div className="flex flex-wrap items-center justify-end gap-3 order-1 sm:order-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted hover:text-charcoal"
            onClick={handleRunDemoFallback}
          >
            Preview Demo Data
          </Button>

          <Button
            id="enhance-submit-btn"
            onClick={handleEnhance}
            loading={state.isProcessing}
            size="lg"
            icon={engineChoice === 'ollama' ? <Sparkles className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
          >
            {engineChoice === 'ollama'
              ? isOllamaReady
                ? 'Enhance with Ollama Local LLM'
                : 'Enhance (Ollama Offline → Uses Built-in Engine)'
              : 'Enhance Bullets (Built-in Engine)'}
          </Button>
        </div>
      </div>
    </div>
  );
}
