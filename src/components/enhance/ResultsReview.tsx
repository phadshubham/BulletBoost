import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Check,
  X,
  Edit3,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileDown,
  ArrowRight,
  CheckCircle2,
  Info,
  Sparkles,
  Mail,
  Send,
  Loader2,
} from 'lucide-react';
import { Button, Badge, DemoIndicator, StatusIndicator } from '../ui';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { findNextPendingBulletId } from '../../utils/review';
import { classifyBullets, enhanceBullets, exportResumeDocx, sendResumeEmail } from '../../services/api';
import { enhanceSingleBulletHeuristically, isCandidateNoOp } from '../../services/heuristicEnhancer';
import { calculateDeltaLocal } from '../../services/atsCalculator';
import { AtsScoreGauge } from './AtsScoreGauge';
import { VisualDiffViewer } from './VisualDiffViewer';
import { EvidenceInterviewer } from './EvidenceInterviewer';
import { PageBudgetWarning } from './PageBudgetWarning';
import type {
  FilterStatus,
  EnhancedBullet,
  QualityLevel,
  BulletQuality,
  BulletClassifyInput,
  ResumeSection,
  ValidationWarning,
} from '../../types';

const filterOptions: { value: FilterStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Needs Review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'no_suggestion', label: 'No Suggestion' },
];

const QUALITY_RANK: Record<string, number> = {
  weak: 1,
  'needs-work': 1,
  adequate: 2,
  strong: 3,
};

function qualityBadge(
  quality?: QualityLevel | BulletQuality | null,
  confidence?: number | null,
  prefix?: string,
  isUnavailable?: boolean,
  hasValidationIssue?: boolean
) {
  if (isUnavailable) {
    return (
      <Badge variant="default" className="text-[11px] py-0.5 text-muted">
        ML Unavailable
      </Badge>
    );
  }
  if (!quality) {
    return (
      <Badge variant="default" className="text-[11px] py-0.5 text-muted-dark">
        {prefix ? `${prefix}: ML Evaluating...` : 'ML Evaluating...'}
      </Badge>
    );
  }
  const isUncertain = confidence !== null && confidence !== undefined && confidence < 0.50;
  const confText =
    confidence !== null && confidence !== undefined
      ? ` (${Math.round(confidence * 100)}% model confidence${isUncertain ? ' · Classification uncertain' : ''})`
      : '';
  const displayLabel =
    quality === 'needs-work' ? 'Needs Work' : quality.charAt(0).toUpperCase() + quality.slice(1);
  const text = prefix ? `${prefix}: ${displayLabel}${confText}` : `${displayLabel}${confText}`;
  const tooltip = isUncertain
    ? 'Classification uncertain: For this experimental 3-class model, confidence under 50% indicates probability is distributed across multiple classes. Category prediction should be interpreted cautiously and does not reflect resume quality.'
    : undefined;

  if (hasValidationIssue) {
    return (
      <Badge variant="warning" className="text-[11px] py-0.5 border border-amber-300" title={tooltip}>
        {text} (Unverified Claims)
      </Badge>
    );
  }

  switch (quality) {
    case 'strong':
      return (
        <Badge variant="success" className="text-[11px] py-0.5" title={tooltip}>
          {text}
        </Badge>
      );
    case 'adequate':
      return (
        <Badge variant="info" className="text-[11px] py-0.5" title={tooltip}>
          {text}
        </Badge>
      );
    case 'weak':
    case 'needs-work':
      return (
        <Badge variant="warning" className="text-[11px] py-0.5" title={tooltip}>
          {text}
        </Badge>
      );
    default:
      return (
        <Badge variant="default" className="text-[11px] py-0.5" title={tooltip}>
          {text}
        </Badge>
      );
  }
}

function statusBadge(status: EnhancedBullet['status']) {
  switch (status) {
    case 'accepted':
      return <Badge variant="success">Accepted</Badge>;
    case 'rejected':
      return <Badge variant="error">Rejected</Badge>;
    case 'review_needed':
      return (
        <Badge variant="warning" className="text-[11px] py-0.5 bg-amber-50 text-amber-800 border border-amber-300">
          Needs Review
        </Badge>
      );
    case 'no_suggestion':
      return (
        <Badge variant="default" className="text-[11px] py-0.5 bg-neutral-100 text-neutral-600 border border-neutral-300">
          No Suggestion
        </Badge>
      );
    case 'pending':
    default:
      return <Badge variant="default">Pending</Badge>;
  }
}

export function ResultsReview() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [filter, setFilter] = useState<FilterStatus>('all');

  // Initial expanded card defaults to the first pending bullet with suggestions (or first bullet)
  const [expandedId, setExpandedId] = useState<string | null>(() => {
    const firstPending = state.enhancedBullets.find(
      (b) => b.status === 'pending' && !isCandidateNoOp(b.original, b.improved)
    );
    return firstPending ? firstPending.id : (state.enhancedBullets[0]?.id ?? null);
  });

  const scrollTargetRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFinalReview, setShowFinalReview] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [showDiffId, setShowDiffId] = useState<string | null>(null);
  const [interviewBulletId, setInterviewBulletId] = useState<string | null>(null);

  const handleAddEvidenceToBullet = async (bullet: EnhancedBullet, evidence: string) => {
    setRegeneratingId(bullet.id);
    try {
      const res = await enhanceBullets(
        {
          bullets: [
            {
              id: bullet.id,
              text: bullet.original,
              section_title: bullet.sectionTitle,
              section_type: 'experience',
            },
          ],
          target_role: state.preferences.targetRole || 'Software Professional',
          job_description: state.preferences.jobDescription,
          writing_style: state.preferences.writingStyle,
          scope: state.preferences.scope,
          supporting_facts: evidence,
        },
        60000
      );

      if (res.bullets && res.bullets.length > 0) {
        const reg = res.bullets[0];
        dispatch({
          type: 'UPDATE_ENHANCED_BULLET',
          bullet: {
            ...bullet,
            improved: reg.improved,
            editedImproved: null,
            explanation: `Enhanced with candidate evidence: "${evidence}"`,
            status: 'pending',
            warnings: reg.warnings || [],
          },
        });
      }
    } catch {
      const fallback = enhanceSingleBulletHeuristically(bullet.original, 1, {
        targetRole: state.preferences.targetRole,
        writingStyle: state.preferences.writingStyle,
        supportingFacts: evidence,
      });
      if (fallback.improved) {
        dispatch({
          type: 'UPDATE_ENHANCED_BULLET',
          bullet: {
            ...bullet,
            improved: fallback.improved,
            editedImproved: null,
            explanation: `Enhanced with candidate evidence: "${evidence}"`,
            status: 'pending',
          },
        });
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  // Map of card DOM elements for smooth scrolling
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const filtered = useMemo(() => {
    if (filter === 'all') return state.enhancedBullets;
    if (filter === 'no_suggestion') {
      return state.enhancedBullets.filter(
        (b) =>
          (b.status === 'no_suggestion' || isCandidateNoOp(b.original, b.improved)) &&
          b.status !== 'review_needed'
      );
    }
    if (filter === 'pending') {
      return state.enhancedBullets.filter(
        (b) =>
          (b.status === 'pending' || b.status === 'review_needed') &&
          !isCandidateNoOp(b.original, b.improved)
      );
    }
    if (filter === 'review_needed') {
      return state.enhancedBullets.filter((b) => b.status === 'review_needed');
    }
    return state.enhancedBullets.filter((b) => b.status === filter);
  }, [state.enhancedBullets, filter]);

  const summary = useMemo(() => {
    const total = state.enhancedBullets.length;
    const accepted = state.enhancedBullets.filter(
      (b) => b.status === 'accepted'
    ).length;
    const rejected = state.enhancedBullets.filter(
      (b) => b.status === 'rejected'
    ).length;
    const noSuggestion = state.enhancedBullets.filter(
      (b) =>
        (b.status === 'no_suggestion' || isCandidateNoOp(b.original, b.improved)) &&
        b.status !== 'review_needed'
    ).length;
    const pending = state.enhancedBullets.filter(
      (b) =>
        (b.status === 'pending' || b.status === 'review_needed') &&
        !isCandidateNoOp(b.original, b.improved)
    ).length;
    return { total, accepted, rejected, noSuggestion, pending };
  }, [state.enhancedBullets]);

  // Smooth scroll effect to bring newly expanded item into view if not comfortably visible
  useEffect(() => {
    const targetId = scrollTargetRef.current;
    if (!targetId) return;
    scrollTargetRef.current = null;

    const frameId = requestAnimationFrame(() => {
      const el = cardRefs.current.get(targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        const viewportHeight =
          window.innerHeight || document.documentElement.clientHeight;
        const headerSafeOffset = 100;
        const bottomSafeOffset = 60;

        const isComfortablyVisible =
          rect.top >= headerSafeOffset &&
          rect.bottom <= viewportHeight - bottomSafeOffset;

        if (!isComfortablyVisible) {
          el.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [expandedId]);

  // Batch evaluate original and proposed bullets with custom scikit-learn classifier
  useEffect(() => {
    let isMounted = true;
    const unclassified = state.enhancedBullets.filter(
      (b) =>
        (b.originalQuality === undefined ||
          (b.status !== 'no_suggestion' &&
            b.improved !== null &&
            !isCandidateNoOp(b.original, b.editedImproved ?? b.improved) &&
            b.improvedQuality === undefined)) &&
        !b.classifierUnavailable
    );

    if (unclassified.length === 0) return;

    const payload: BulletClassifyInput[] = [];
    for (const b of unclassified) {
      if (b.originalQuality === undefined) {
        payload.push({ id: `${b.id}:orig`, text: b.original });
      }
      const hasRealSuggestion =
        b.status !== 'no_suggestion' &&
        b.improved !== null &&
        !isCandidateNoOp(b.original, b.editedImproved ?? b.improved);
      if (hasRealSuggestion && b.improvedQuality === undefined) {
        payload.push({ id: `${b.id}:improved`, text: (b.editedImproved ?? b.improved)! });
      }
    }

    classifyBullets(payload)
      .then((res) => {
        if (!isMounted) return;
        const predMap = new Map(res.predictions.map((p) => [p.id, p]));
        const updates = unclassified.map((b) => {
          const origPred = predMap.get(`${b.id}:orig`);
          const hasRealSuggestion =
            b.status !== 'no_suggestion' &&
            b.improved !== null &&
            !isCandidateNoOp(b.original, b.editedImproved ?? b.improved);
          const impPred = hasRealSuggestion ? predMap.get(`${b.id}:improved`) : null;

          const unavailable =
            origPred?.status === 'model_unavailable' ||
            (hasRealSuggestion && impPred?.status === 'model_unavailable');

          return {
            bulletId: b.id,
            expectedOriginalText: b.original,
            expectedImprovedText: hasRealSuggestion ? (b.editedImproved ?? b.improved) : null,
            originalQuality: origPred ? origPred.quality : b.originalQuality,
            originalConfidence: origPred ? origPred.confidence : b.originalConfidence,
            improvedQuality: hasRealSuggestion ? (impPred ? impPred.quality : b.improvedQuality) : null,
            improvedConfidence: hasRealSuggestion ? (impPred ? impPred.confidence : b.improvedConfidence) : null,
            classifierUnavailable: unavailable,
          };
        });
        dispatch({ type: 'SET_BATCH_BULLET_CLASSIFICATIONS', classifications: updates });
      })
      .catch(() => {
        if (!isMounted) return;
        const updates = unclassified.map((b) => ({
          bulletId: b.id,
          expectedOriginalText: b.original,
          expectedImprovedText: b.editedImproved ?? b.improved,
          classifierUnavailable: true,
        }));
        dispatch({ type: 'SET_BATCH_BULLET_CLASSIFICATIONS', classifications: updates });
      });

    return () => {
      isMounted = false;
    };
  }, [state.enhancedBullets, dispatch]);

  const handleFilterChange = (newFilter: FilterStatus) => {
    setFilter(newFilter);
    const newFiltered =
      newFilter === 'all'
        ? state.enhancedBullets
        : state.enhancedBullets.filter((b) => b.status === newFilter);

    // If currently expanded item is not visible under the new filter, expand the first one
    if (newFiltered.length > 0 && !newFiltered.some((b) => b.id === expandedId)) {
      const nextId =
        newFilter === 'pending'
          ? (newFiltered.find((b) => b.status === 'pending')?.id ?? newFiltered[0].id)
          : newFiltered[0].id;
      scrollTargetRef.current = nextId;
      setExpandedId(nextId);
    }
  };

  const handleAccept = (id: string) => {
    // 1. If currently editing this bullet, commit the edit text immediately
    if (editingId === id && editText.trim()) {
      dispatch({
        type: 'SET_BULLET_EDITED_TEXT',
        bulletId: id,
        text: editText.trim(),
      });
      setEditingId(null);
    }

    // 2. Identify the next pending bullet in the sequence
    const nextPendingId = findNextPendingBulletId(state.enhancedBullets, id);

    // 3. Mark the current bullet as accepted
    dispatch({ type: 'SET_BULLET_STATUS', bulletId: id, status: 'accepted' });

    // 4. Update expanded card to the next pending bullet and schedule scroll
    scrollTargetRef.current = nextPendingId;
    setExpandedId(nextPendingId);
  };

  const handleReject = (id: string) => {
    if (editingId === id) {
      setEditingId(null);
    }

    // If viewing Needs Review, the rejected item leaves this filter,
    // so seamlessly advance the expanded item to the next pending item
    if (filter === 'pending' && expandedId === id) {
      const nextPendingId = findNextPendingBulletId(state.enhancedBullets, id);
      scrollTargetRef.current = nextPendingId;
      setExpandedId(nextPendingId);
    }

    dispatch({ type: 'SET_BULLET_STATUS', bulletId: id, status: 'rejected' });
  };

  const handleStartEdit = (bullet: EnhancedBullet) => {
    setEditingId(bullet.id);
    setEditText(bullet.editedImproved ?? bullet.improved ?? bullet.original);
  };

function validateEditedText(
  original: string,
  edited: string,
  supportingFacts: string = ''
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const combinedSource = `${original} ${supportingFacts}`.toLowerCase();

  // 1. Numerical & metric validation
  const numPattern = /\b(?:\$?\d+(?:[\.,]\d+)?\s*(?:%|k|m|b|x|ms|s|h|sec|min|hours?|days?|months?|years?|fold)?|\d+\+)\b/gi;
  const origMatches = new Set((combinedSource.match(numPattern) || []).map((m) => m.toLowerCase().replace(/,/g, '')));
  const editedMatches = (edited.match(numPattern) || []).map((m) => m.toLowerCase().replace(/,/g, ''));

  for (const m of editedMatches) {
    const digitOnly = m.replace(/[^\d]/g, '');
    const origDigits = new Set(Array.from(origMatches).map((om) => om.replace(/[^\d]/g, '')));
    if (!origMatches.has(m) && (!digitOnly || !origDigits.has(digitOnly))) {
      warnings.push({
        type: 'unverified-metric',
        message: `The edited text introduces metric '${m}', which was not in your original bullet. Verify this metric before saving.`,
      });
    }
  }

  // 2. Unverified outcome claims
  const outcomeChecks = [
    { regex: /\b(?:improving|increased?|boost(?:ing|ed)?|higher)\s+throughput\b/i, label: 'throughput improvement' },
    { regex: /\b(?:reduc(?:ing|ed)|lower(?:ing|ed)?|cutting)\s+(?:system\s+)?overhead\b/i, label: 'system overhead reduction' },
    { regex: /\b(?:slash(?:ing|ed)|cut(?:ting)?|reduc(?:ing|ed))\s+latency\b/i, label: 'latency reduction' },
  ];
  for (const check of outcomeChecks) {
    if (check.regex.test(edited) && !check.regex.test(combinedSource)) {
      warnings.push({
        type: 'vague-claim',
        message: `The edited text introduces an unverified ${check.label}.`,
      });
    }
  }

  return warnings;
}

  const handleSaveEdit = async (id: string) => {
    const trimmed = editText.trim();
    const bullet = state.enhancedBullets.find((b) => b.id === id);
    if (!bullet) return;

    const newWarnings = validateEditedText(bullet.original, trimmed, state.preferences.jobDescription);
    setEditingId(null);

    const isEditNoOp = isCandidateNoOp(bullet.original, trimmed);
    if (isEditNoOp) {
      dispatch({
        type: 'UPDATE_ENHANCED_BULLET',
        bullet: {
          ...bullet,
          improved: null,
          editedImproved: null,
          warnings: [],
          status: 'no_suggestion',
          explanation: 'The original bullet is already clear, or no meaningful improvement was found.',
          improvedQuality: null,
          improvedConfidence: null,
        },
      });
      return;
    }

    // Reclassify the edited text via custom ML model
    let impQuality = bullet.improvedQuality;
    let impConfidence = bullet.improvedConfidence;
    let classifierUnavailable = bullet.classifierUnavailable;

    try {
      const res = await classifyBullets([{ id: `${id}:improved`, text: trimmed }]);
      const pred = res.predictions[0];
      if (pred && pred.status === 'success') {
        impQuality = pred.quality;
        impConfidence = pred.confidence;
        classifierUnavailable = false;
      } else if (pred && pred.status === 'model_unavailable') {
        classifierUnavailable = true;
      }
    } catch {
      // Retain edited text safely
    }

    dispatch({
      type: 'UPDATE_ENHANCED_BULLET',
      bullet: {
        ...bullet,
        editedImproved: trimmed,
        warnings: newWarnings,
        improvedQuality: impQuality,
        improvedConfidence: impConfidence,
        classifierUnavailable,
      },
    });
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API might not be available in non-secure context
    }
  };

  const handleRegenerate = async (bullet: EnhancedBullet) => {
    setRegeneratingId(bullet.id);
    setRegenerateError(null);
    try {
      const response = await enhanceBullets({
        bullets: [
          {
            id: bullet.originalBulletId,
            text: bullet.original,
            section_title: bullet.sectionTitle,
            section_type: 'experience',
          },
        ],
        target_role: state.preferences.targetRole || 'Professional',
        job_description: state.preferences.jobDescription,
        writing_style: state.preferences.writingStyle,
        scope: state.preferences.scope,
        supporting_facts: '',
      });

      if (response.bullets && response.bullets.length > 0) {
        const regenerated = response.bullets[0];
        const isRegenNoOp =
          regenerated.status === 'no_suggestion' ||
          !regenerated.improved ||
          isCandidateNoOp(bullet.original, regenerated.improved);

        // Re-classify the new improved text only if genuine suggestion exists
        let impQuality: BulletQuality | null = null;
        let impConfidence: number | null = null;
        if (!isRegenNoOp && regenerated.improved) {
          try {
            const classRes = await classifyBullets([{ id: `${bullet.id}:regen`, text: regenerated.improved }]);
            const pred = classRes.predictions[0];
            if (pred && pred.status === 'success') {
              impQuality = pred.quality;
              impConfidence = pred.confidence;
            }
          } catch {
            // keep null if classifier unreachable
          }
        }

        dispatch({
          type: 'UPDATE_ENHANCED_BULLET',
          bullet: {
            ...bullet,
            improved: isRegenNoOp ? null : regenerated.improved,
            editedImproved: null,
            explanation: isRegenNoOp
              ? 'The original bullet is already clear, or no meaningful improvement was found.'
              : regenerated.explanation,
            warnings: isRegenNoOp ? [] : (regenerated.warnings || []),
            missingEvidence: isRegenNoOp ? [] : (regenerated.missingEvidence || []),
            alternativeTexts: isRegenNoOp ? [] : (regenerated.alternativeTexts || []),
            status: isRegenNoOp ? 'no_suggestion' : 'pending',
            improvedQuality: impQuality,
            improvedConfidence: impConfidence,
          },
        });
      }
    } catch (err: unknown) {
      // If Ollama is offline or fails, fall back to heuristic regeneration variation
      try {
        const fallback = enhanceSingleBulletHeuristically(
          bullet.original,
          Math.floor(Math.random() * 8) + 1,
          {
            targetRole: state.preferences.targetRole || 'Software Professional',
            writingStyle: state.preferences.writingStyle,
            jobDescription: state.preferences.jobDescription,
          }
        );

        const isFallbackNoOp =
          !fallback.improved || isCandidateNoOp(bullet.original, fallback.improved);

        dispatch({
          type: 'UPDATE_ENHANCED_BULLET',
          bullet: {
            ...bullet,
            improved: isFallbackNoOp ? null : fallback.improved,
            editedImproved: null,
            explanation: isFallbackNoOp
              ? 'The original bullet is already clear, or no meaningful improvement was found.'
              : fallback.explanation,
            warnings: isFallbackNoOp ? [] : (fallback.warnings || []),
            alternativeTexts: isFallbackNoOp ? [] : (fallback.alternatives || []),
            status: isFallbackNoOp ? 'no_suggestion' : 'pending',
            improvedQuality: null,
            improvedConfidence: null,
          },
        });
      } catch {
        const msg = err instanceof Error ? err.message : 'Regeneration failed.';
        setRegenerateError(`Regeneration failed: ${msg}`);
        setTimeout(() => setRegenerateError(null), 5000);
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleBack = () => {
    dispatch({ type: 'SET_STEP', step: 'preferences' });
  };

  if (showFinalReview) {
    return (
      <FinalReview
        bullets={state.enhancedBullets}
        sections={state.sections}
        importedFileName={state.importedFile?.name}
        onBack={() => setShowFinalReview(false)}
      />
    );
  }

  const isAllReviewed = summary.total > 0 && summary.pending === 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-xl font-semibold text-charcoal">
              Review Improvements
            </h2>
            {state.isDemo && <DemoIndicator />}
          </div>
          <p className="text-sm text-muted">
            Review each proposed improvement. Accepting automatically advances to the next pending bullet.
          </p>
        </div>
      </div>

      {/* ATS Live Score Gauge & Optimization Dashboard */}
      <div className="mb-5">
        <AtsScoreGauge score={state.atsScore || null} />
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-sage-light rounded-md">
        <Badge variant="default">{summary.total} total</Badge>
        <Badge variant="success">{summary.accepted} accepted</Badge>
        <Badge variant="error">{summary.rejected} rejected</Badge>
        {summary.noSuggestion > 0 && (
          <Badge variant="default" className="bg-neutral-100 text-neutral-600 border border-neutral-300">
            {summary.noSuggestion} no suggestion
          </Badge>
        )}
        <Badge variant={summary.pending > 0 ? 'info' : 'default'}>
          {summary.pending} pending
        </Badge>

        {summary.accepted > 0 && (
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={() => setShowFinalReview(true)}
              icon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Final Review
            </Button>
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border mb-4">
        {filterOptions.map((opt) => {
          let count = 0;
          if (opt.value === 'all') {
            count = state.enhancedBullets.length;
          } else if (opt.value === 'no_suggestion') {
            count = summary.noSuggestion;
          } else if (opt.value === 'pending') {
            count = summary.pending;
          } else if (opt.value === 'accepted') {
            count = summary.accepted;
          } else if (opt.value === 'rejected') {
            count = summary.rejected;
          }

          return (
            <button
              key={opt.value}
              id={`filter-tab-${opt.value}`}
              className={`
                px-3 py-2 text-sm border-b-2 -mb-px transition-colors duration-150 focus-ring
                ${
                  filter === opt.value
                    ? 'border-forest text-forest font-medium'
                    : 'border-transparent text-muted hover:text-charcoal'
                }
              `}
              onClick={() => handleFilterChange(opt.value)}
            >
              {opt.label}
              <span className="ml-1.5 text-xs text-muted-light">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Notice when all bullets are reviewed in "all" view */}
      {isAllReviewed && filter === 'all' && (
        <div className="p-3.5 rounded-lg bg-green-50 border border-green-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 animate-fade-in text-xs sm:text-sm text-green-900">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-forest flex-shrink-0" />
            <span>
              All bullets have been reviewed ({summary.accepted} accepted, {summary.rejected} rejected
              {summary.noSuggestion > 0 ? `, ${summary.noSuggestion} preserved as original` : ''}).
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-green-300 text-forest hover:bg-green-100 text-xs py-1 h-auto self-start sm:self-auto"
            onClick={() => setShowFinalReview(true)}
          >
            Go to Final Review
          </Button>
        </div>
      )}

      {/* Bullet review cards */}
      {filtered.length === 0 ? (
        isAllReviewed && filter === 'pending' ? (
          /* Clear review-completed state */
          <div className="border border-green-200 bg-green-50/60 rounded-lg p-6 sm:p-8 text-center animate-fade-in my-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 shadow-xs">
              <CheckCircle2 className="w-6 h-6 text-forest" />
            </div>
            <h3 className="text-base font-semibold text-charcoal mb-1">
              All Bullets Reviewed!
            </h3>
            <p className="text-sm text-muted max-w-md mx-auto mb-5 leading-relaxed">
              You have completed reviewing all suggestions (
              <span className="text-forest font-semibold">{summary.accepted} accepted</span>,{' '}
              <span className="text-red-700 font-semibold">{summary.rejected} rejected</span>
              {summary.noSuggestion > 0 && (
                <>, <span className="text-neutral-700 font-medium">{summary.noSuggestion} preserved as original</span></>
              )}). Inspect and export your enhanced content in Final Review.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFilterChange('all')}
              >
                View All Bullets
              </Button>
              <Button
                size="sm"
                icon={<ArrowRight className="w-4 h-4" />}
                onClick={() => setShowFinalReview(true)}
              >
                Go to Final Review
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 text-sm text-muted border border-dashed border-border rounded-lg bg-sage-light/20 my-3">
            No bullets match this filter.
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((bullet) => {
            const isExpanded = expandedId === bullet.id;
            const isEditing = editingId === bullet.id;
            const isReviewNeeded = bullet.status === 'review_needed';
            const isNoOp =
              !isReviewNeeded &&
              (bullet.status === 'no_suggestion' ||
                bullet.improved === null ||
                isCandidateNoOp(bullet.original, bullet.editedImproved ?? bullet.improved));
            const displayImproved =
              bullet.editedImproved ?? bullet.improved;
            const atsDelta = calculateDeltaLocal(bullet.original, displayImproved || bullet.original);

            return (
              <div
                key={bullet.id}
                id={`bullet-card-${bullet.id}`}
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(bullet.id, el);
                  } else {
                    cardRefs.current.delete(bullet.id);
                  }
                }}
                className={`
                  border rounded-lg bg-white overflow-hidden transition-all duration-150
                  ${
                    isReviewNeeded
                      ? 'border-amber-300 bg-amber-50/20'
                      : isNoOp
                        ? 'border-neutral-200 bg-neutral-50/20'
                        : bullet.status === 'accepted'
                          ? 'border-green-200 shadow-xs'
                          : bullet.status === 'rejected'
                            ? 'border-red-200 opacity-80'
                            : isExpanded
                              ? 'border-forest/60 shadow-xs ring-1 ring-forest/20'
                              : 'border-border'
                  }
                `}
              >
                {/* Card header */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left focus-ring transition-colors hover:bg-neutral-50/70"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : bullet.id)
                  }
                  aria-expanded={isExpanded}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-muted truncate">
                        {bullet.sectionTitle}
                      </span>
                      {bullet.classifierUnavailable ? (
                        <Badge variant="default" className="text-[11px] py-0.5 text-muted">
                          ML Classifier Unavailable
                        </Badge>
                      ) : isNoOp || isReviewNeeded ? (
                        qualityBadge(bullet.originalQuality, bullet.originalConfidence, 'Category')
                      ) : (
                        <>
                          {qualityBadge(bullet.originalQuality, bullet.originalConfidence, 'Orig')}
                          <span className="text-muted-light text-xs font-mono">→</span>
                          {qualityBadge(
                            bullet.improvedQuality ?? bullet.quality,
                            bullet.improvedConfidence,
                            'Proposed',
                            bullet.classifierUnavailable,
                            bullet.warnings.length > 0
                          )}
                        </>
                      )}
                      {statusBadge(bullet.status)}
                      {atsDelta.delta > 0 && !isNoOp && (
                        <span
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                          title={atsDelta.breakdown.join(' · ')}
                        >
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          Positively Affects ATS Score
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-charcoal line-clamp-1">
                      {bullet.original}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                  )}
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border animate-slide-down">
                    {isReviewNeeded ? (
                      <div className="p-4 space-y-4">
                        {/* Original bullet */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                            <p className="text-xs font-medium text-muted uppercase tracking-wide">
                              Original Bullet (Preserved)
                            </p>
                            {qualityBadge(
                              bullet.originalQuality,
                              bullet.originalConfidence,
                              'Predicted Category',
                              bullet.classifierUnavailable
                            )}
                          </div>
                          <p className="text-sm text-charcoal leading-relaxed bg-sage-light/50 rounded p-3">
                            {bullet.original}
                          </p>
                        </div>

                        {/* Honest review-needed warning panel */}
                        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3.5 flex items-start gap-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-semibold text-amber-900 mb-0.5">
                              Unable to produce a safe improvement. Your original text has been preserved.
                            </h4>
                            <p className="text-xs text-amber-800 leading-relaxed">
                              {bullet.explanation ||
                                'Validation or generation encountered an issue. Unsupported claims or unverified metrics were withheld to protect your resume integrity.'}
                            </p>
                          </div>
                        </div>

                        {/* Actions for Review-Needed item */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                          <span className="text-xs text-muted italic">
                            Original wording retained in final review & export unless regenerated.
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              id={`keep-original-btn-${bullet.id}`}
                              size="sm"
                              variant="secondary"
                              onClick={() => handleAccept(bullet.id)}
                            >
                              Keep Original
                            </Button>
                            <Button
                              id={`copy-btn-${bullet.id}`}
                              size="sm"
                              variant="ghost"
                              icon={<Copy className="w-3.5 h-3.5" />}
                              onClick={() => handleCopy(bullet.original, bullet.id)}
                            >
                              {copiedId === bullet.id ? 'Copied!' : 'Copy Original'}
                            </Button>
                            <Button
                              id={`regenerate-btn-${bullet.id}`}
                              size="sm"
                              variant="ghost"
                              icon={
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    regeneratingId === bullet.id
                                      ? 'animate-spin text-forest'
                                      : ''
                                  }`}
                                />
                              }
                              onClick={() => handleRegenerate(bullet)}
                              disabled={regeneratingId !== null}
                              title="Try generating an alternative improvement with Ollama"
                            >
                              {regeneratingId === bullet.id
                                ? 'Regenerating...'
                                : 'Regenerate'}
                            </Button>
                          </div>
                        </div>
                        {regenerateError && (
                          <p className="text-xs text-rose-600 mt-2 px-1">
                            {regenerateError}
                          </p>
                        )}
                      </div>
                    ) : isNoOp ? (
                      <div className="p-4 space-y-4">
                        {/* Original bullet */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                            <p className="text-xs font-medium text-muted uppercase tracking-wide">
                              Original Bullet (Preserved)
                            </p>
                            {qualityBadge(
                              bullet.originalQuality,
                              bullet.originalConfidence,
                              'Predicted Category',
                              bullet.classifierUnavailable
                            )}
                          </div>
                          <p className="text-sm text-charcoal leading-relaxed bg-sage-light/50 rounded p-3">
                            {bullet.original}
                          </p>
                        </div>

                        {/* Neutral no-suggestion message */}
                        <div className="rounded-md border border-neutral-200 bg-neutral-50/80 p-3.5 flex items-start gap-2.5">
                          <Info className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-xs font-semibold text-charcoal mb-0.5">
                              No suggestion needed
                            </h4>
                            <p className="text-xs text-muted leading-relaxed">
                              The original bullet is already clear, and no meaningful improvement was identified. Your original wording will be preserved.
                            </p>
                          </div>
                        </div>

                        {/* Actions for No-Suggestion item */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                          <span className="text-xs text-muted italic">
                            Original wording retained in final review & export.
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              id={`copy-btn-${bullet.id}`}
                              size="sm"
                              variant="ghost"
                              icon={<Copy className="w-3.5 h-3.5" />}
                              onClick={() => handleCopy(bullet.original, bullet.id)}
                            >
                              {copiedId === bullet.id ? 'Copied!' : 'Copy Original'}
                            </Button>
                            <Button
                              id={`regenerate-btn-${bullet.id}`}
                              size="sm"
                              variant="ghost"
                              icon={
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${
                                    regeneratingId === bullet.id
                                      ? 'animate-spin text-forest'
                                      : ''
                                  }`}
                                />
                              }
                              onClick={() => handleRegenerate(bullet)}
                              disabled={regeneratingId !== null}
                              title="Try generating an alternative improvement with Ollama"
                            >
                              {regeneratingId === bullet.id
                                ? 'Regenerating...'
                                : 'Regenerate'}
                            </Button>
                          </div>
                        </div>
                        {regenerateError && (
                          <p className="text-xs text-rose-600 mt-2 px-1">
                            {regenerateError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 space-y-4">
                        {/* Original */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                            <p className="text-xs font-medium text-muted uppercase tracking-wide">
                              Original
                            </p>
                            {qualityBadge(
                              bullet.originalQuality,
                              bullet.originalConfidence,
                              'Category',
                              bullet.classifierUnavailable
                            )}
                          </div>
                          <p className="text-sm text-charcoal leading-relaxed bg-sage-light/50 rounded p-3">
                            {bullet.original}
                          </p>
                        </div>

                        {/* Improved */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                            <p className="text-xs font-medium text-muted uppercase tracking-wide">
                              Proposed Improvement
                            </p>
                            {qualityBadge(
                              bullet.improvedQuality ?? bullet.quality,
                              bullet.improvedConfidence,
                              'Category',
                              bullet.classifierUnavailable,
                              bullet.warnings.length > 0
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-full px-3 py-2.5 text-sm rounded-md border border-forest bg-white text-charcoal focus-ring resize-vertical leading-relaxed"
                                rows={3}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(bullet.id)}
                                >
                                  Save & Re-evaluate
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-charcoal leading-relaxed bg-success-bg/50 rounded p-3">
                              {displayImproved}
                              {bullet.editedImproved && (
                                <span className="text-xs text-forest ml-2 font-mono">
                                  (reclassified)
                                </span>
                              )}
                            </p>
                          )}

                          {/* Controls for Visual Diff, Context Interviewer, Page Budget */}
                          {!isEditing && displayImproved && (
                            <div className="space-y-2 mt-2">
                              <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setShowDiffId(showDiffId === bullet.id ? null : bullet.id)}
                                  className="text-forest hover:text-forest-dark font-medium underline flex items-center gap-1 cursor-pointer"
                                >
                                  {showDiffId === bullet.id ? 'Hide Word-Level Diff' : 'View Word-Level Diff'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInterviewBulletId(interviewBulletId === bullet.id ? null : bullet.id)}
                                  className="text-indigo-700 hover:text-indigo-900 font-medium flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200"
                                >
                                  💡 Add Verified Evidence / Context
                                </button>
                              </div>

                              {showDiffId === bullet.id && (
                                <VisualDiffViewer original={bullet.original} improved={displayImproved} />
                              )}

                              <EvidenceInterviewer
                                isOpen={interviewBulletId === bullet.id}
                                bulletText={bullet.original}
                                onClose={() => setInterviewBulletId(null)}
                                onAddEvidence={(ev) => handleAddEvidenceToBullet(bullet, ev)}
                              />

                              <PageBudgetWarning
                                wordCount={atsDelta.wordCount}
                                isOrphan={atsDelta.isOrphan}
                                onTighten={() => {
                                  const words = displayImproved.split(' ');
                                  if (words.length > 5) {
                                    setEditingId(bullet.id);
                                    setEditText(words.slice(0, words.length - 2).join(' ') + '.');
                                  }
                                }}
                              />
                            </div>
                          )}

                          {/* Model comparison notice */}
                          {bullet.originalQuality &&
                            bullet.improvedQuality &&
                            !bullet.classifierUnavailable && (
                              <div className="rounded border text-xs p-2.5 leading-relaxed mt-2.5">
                                {bullet.warnings.length > 0 ? (
                                  <div className="flex items-start gap-2 text-amber-900 bg-amber-50/70 p-1.5 rounded">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-semibold">Evidence Validation Notice:</span>{' '}
                                      This proposal contains unverified claims or metrics flagged by validation.
                                      The ML classifier score reflects linguistic phrasing, not factual truthfulness.
                                      Verify or edit the bullet before accepting.
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {QUALITY_RANK[bullet.improvedQuality] >
                                      QUALITY_RANK[bullet.originalQuality] && (
                                      <div className="flex items-start gap-2 text-green-900 bg-green-50/70 p-1.5 rounded">
                                        <CheckCircle2 className="w-4 h-4 text-forest flex-shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold">Quality Category Uplift:</span>{' '}
                                          Original estimated as{' '}
                                          <span className="font-semibold uppercase">
                                            {bullet.originalQuality}
                                          </span>
                                          , proposed estimated as{' '}
                                          <span className="font-semibold uppercase">
                                            {bullet.improvedQuality}
                                          </span>{' '}
                                          by the ML classifier. The rewrite reflects stronger action verbs
                                          and technical specificity. Note: ML classifier predictions reflect category estimates on phrasing, not verified resume performance.
                                        </div>
                                      </div>
                                    )}
                                    {QUALITY_RANK[bullet.improvedQuality] ===
                                      QUALITY_RANK[bullet.originalQuality] && (
                                      <div className="flex items-start gap-2 text-blue-900 bg-blue-50/70 p-1.5 rounded">
                                        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold">Same Quality Category:</span>{' '}
                                          Both versions categorized as{' '}
                                          <span className="font-semibold uppercase">
                                            {bullet.improvedQuality}
                                          </span>{' '}
                                          (ML Model Prediction). The rewrite sharpens phrasing, but review
                                          to ensure all relevant technical context is represented.
                                        </div>
                                      </div>
                                    )}
                                    {QUALITY_RANK[bullet.improvedQuality] <
                                      QUALITY_RANK[bullet.originalQuality] && (
                                      <div className="flex items-start gap-2 text-amber-900 bg-amber-50/70 p-1.5 rounded">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-semibold">Review Notice:</span> Proposed
                                          text is classified lower (
                                          <span className="font-semibold uppercase">
                                            {bullet.improvedQuality}
                                          </span>
                                          ) than original (
                                          <span className="font-semibold uppercase">
                                            {bullet.originalQuality}
                                          </span>
                                          ) by the ML classifier. Check that valuable details were not
                                          over-condensed before accepting.
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                        </div>

                        {/* Explanation */}
                        <div>
                          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5">
                            Why this change
                          </p>
                          <p className="text-sm text-muted leading-relaxed">
                            {bullet.explanation}
                          </p>
                        </div>

                        {/* Warnings */}
                        {bullet.warnings.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted uppercase tracking-wide">
                              Validation Notices
                            </p>
                            {bullet.warnings.map((w, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2 text-sm text-warning bg-warning-bg/50 rounded p-2.5"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span className="text-xs leading-relaxed">
                                  {w.message}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggested Evidence */}
                        {bullet.missingEvidence && bullet.missingEvidence.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted uppercase tracking-wide">
                              Evidence Opportunities
                            </p>
                            {bullet.missingEvidence.map((ev, i) => (
                              <div
                                key={i}
                                className="text-xs text-muted leading-relaxed bg-sage-light/40 border border-border/60 rounded p-2.5"
                              >
                                💡 <span className="font-medium text-charcoal">Consider adding:</span> {ev}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                          <Button
                            id={`accept-btn-${bullet.id}`}
                            size="sm"
                            variant={
                              bullet.status === 'accepted'
                                ? 'primary'
                                : 'secondary'
                            }
                            icon={<Check className="w-3.5 h-3.5" />}
                            onClick={() => handleAccept(bullet.id)}
                          >
                            {bullet.status === 'accepted'
                              ? 'Accepted'
                              : 'Accept'}
                          </Button>
                          <Button
                            id={`reject-btn-${bullet.id}`}
                            size="sm"
                            variant={
                              bullet.status === 'rejected'
                                ? 'danger'
                                : 'secondary'
                            }
                            icon={<X className="w-3.5 h-3.5" />}
                            onClick={() => handleReject(bullet.id)}
                          >
                            {bullet.status === 'rejected'
                              ? 'Rejected'
                              : 'Reject'}
                          </Button>
                          <Button
                            id={`edit-btn-${bullet.id}`}
                            size="sm"
                            variant="ghost"
                            icon={<Edit3 className="w-3.5 h-3.5" />}
                            onClick={() => handleStartEdit(bullet)}
                          >
                            Edit
                          </Button>
                          <Button
                            id={`copy-btn-${bullet.id}`}
                            size="sm"
                            variant="ghost"
                            icon={<Copy className="w-3.5 h-3.5" />}
                            onClick={() =>
                              handleCopy(displayImproved ?? bullet.original, bullet.id)
                            }
                          >
                            {copiedId === bullet.id ? 'Copied!' : 'Copy'}
                          </Button>
                          <Button
                            id={`regenerate-btn-${bullet.id}`}
                            size="sm"
                            variant="ghost"
                            icon={
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${
                                  regeneratingId === bullet.id
                                    ? 'animate-spin text-forest'
                                    : ''
                                }`}
                              />
                            }
                            onClick={() => handleRegenerate(bullet)}
                            disabled={regeneratingId !== null}
                            title="Regenerate this bullet using local Ollama model"
                          >
                            {regeneratingId === bullet.id
                              ? 'Regenerating...'
                              : 'Regenerate'}
                          </Button>
                        </div>
                        {regenerateError && (
                          <p className="text-xs text-rose-600 mt-2 px-1">
                            {regenerateError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={handleBack}>
          Back to Preferences
        </Button>
        {summary.accepted > 0 && (
          <Button
            size="lg"
            onClick={() => setShowFinalReview(true)}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            Final Review ({summary.accepted} accepted)
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Final Review sub-component ──────────────────────────────────────

function FinalReview({
  bullets,
  sections,
  importedFileName,
  onBack,
}: {
  bullets: EnhancedBullet[];
  sections: ResumeSection[];
  importedFileName?: string | null;
  onBack: () => void;
}) {
  const state = useAppState();
  const accepted = bullets.filter((b) => b.status === 'accepted');
  const [copiedAll, setCopiedAll] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Resend Email Integration states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState(
    state.preferences.targetRole
      ? `Optimized Resume Application — ${state.preferences.targetRole}`
      : 'Optimized Resume Application'
  );
  const [emailMessage, setEmailMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const handleSendEmail = async () => {
    if (!emailRecipient.trim() || !emailRecipient.includes('@')) {
      setEmailStatus({
        type: 'error',
        message: 'Please provide a valid recipient email address (e.g. recruiter@company.com).',
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const acceptedBulletsPayload = accepted.map((b) => ({
        bullet_id: b.originalBulletId || (b as any).original_bullet_id || b.id,
        text: (b.editedImproved ?? b.improved ?? b.original).trim(),
      }));

      let baseName = 'BulletBoost_Enhanced_Resume.docx';
      if (importedFileName) {
        const nameWithoutExt = importedFileName.replace(/\.[^/.]+$/, '');
        baseName = `${nameWithoutExt}_enhanced.docx`;
      }

      const res = await sendResumeEmail({
        recipient_email: emailRecipient.trim(),
        sections: sections,
        accepted_bullets: acceptedBulletsPayload,
        filename: baseName,
        subject: emailSubject,
        message: emailMessage,
        target_role: state.preferences.targetRole,
      });

      if (res.status === 'success') {
        setEmailStatus({
          type: 'success',
          message: `Resume successfully delivered to ${res.recipient} via Resend! (ID: ${res.email_id || 'sent'})`,
        });
      } else if (res.status === 'api_key_missing') {
        setEmailStatus({
          type: 'warning',
          message: 'Resend API key is not configured. Add RESEND_API_KEY to your backend .env file to enable live email delivery via Resend (https://resend.com).',
        });
      } else {
        setEmailStatus({ type: 'error', message: res.message });
      }
    } catch (err: unknown) {
      setEmailStatus({
        type: 'error',
        message: (err as Error).message || 'Failed to send resume email.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCopyAll = async () => {
    const text = accepted
      .map((b) => `• ${b.editedImproved ?? b.improved ?? b.original}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // Clipboard might not be available
    }
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const acceptedBulletsPayload = accepted.map((b) => ({
        bullet_id: b.originalBulletId || (b as any).original_bullet_id || b.id,
        text: (b.editedImproved ?? b.improved ?? b.original).trim(),
      }));

      let baseName = 'BulletBoost_Enhanced_Resume.docx';
      if (importedFileName) {
        const nameWithoutExt = importedFileName.replace(/\.[^/.]+$/, '');
        baseName = `${nameWithoutExt}_enhanced.docx`;
      }

      const blob = await exportResumeDocx({
        filename: baseName,
        sections: sections,
        accepted_bullets: acceptedBulletsPayload,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = baseName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccess(`Successfully downloaded "${baseName}"!`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      setExportError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-charcoal">Final Review</h2>
        <p className="text-sm text-muted mt-1.5">
          {accepted.length} improved bullet{accepted.length !== 1 ? 's' : ''}{' '}
          ready for your resume.
        </p>
      </div>

      {/* Final ATS Score Performance Dashboard */}
      <div className="mb-6">
        <AtsScoreGauge score={state.atsScore || null} />
      </div>

      <div className="bg-white border border-border rounded-lg overflow-hidden shadow-xs">
        {accepted.map((bullet, i) => {
          const currentText = bullet.editedImproved ?? bullet.improved ?? bullet.original;
          const atsDelta = calculateDeltaLocal(bullet.original, currentText);

          return (
            <div
              key={bullet.id}
              className={`px-5 py-3.5 ${i > 0 ? 'border-t border-border/50' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-muted font-medium">{bullet.sectionTitle}</p>
                {atsDelta.delta > 0 && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                    title={atsDelta.breakdown.join(' · ')}
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Positively Affects ATS Score
                  </span>
                )}
              </div>
              <p className="text-sm text-charcoal leading-relaxed">
                • {currentText}
              </p>
            </div>
          );
        })}
      </div>

      {accepted.length === 0 && (
        <div className="text-center py-10 text-sm text-muted border border-dashed border-border rounded-lg bg-sage-light/20 my-4">
          No accepted improvements yet. Go back to review and accept changes.
        </div>
      )}

      <StatusIndicator
        type="info"
        message="DOCX export generates a clean formatted resume replacing only your accepted bullets. Unchanged sections and bullets retain their original text."
        className="mt-4"
      />

      {exportError && (
        <StatusIndicator
          type="warning"
          message={exportError}
          className="mt-2"
        />
      )}

      {exportSuccess && (
        <StatusIndicator
          type="success"
          message={exportSuccess}
          className="mt-2"
        />
      )}

      {/* Resend Email Delivery Card */}
      {showEmailModal && (
        <div className="mt-4 p-5 rounded-xl border border-indigo-200 bg-indigo-50/40 animate-slide-down space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-charcoal text-sm flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600" /> Deliver Enhanced Resume via Resend
            </h4>
            <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
              https://resend.com
            </span>
          </div>
          <p className="text-xs text-muted">
            Auto-drafts a professional email with your enhanced Word document attached and dispatches via Resend API.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-charcoal mb-1">
                Recipient Email Address *
              </label>
              <input
                type="email"
                placeholder="e.g. recruiter@company.com"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-forest"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-charcoal mb-1">
                Subject Line
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-forest"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-charcoal mb-1">
              Optional Note / Body Message
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Please find my updated resume attached for the position."
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-forest resize-vertical"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted italic">
              Attached: {importedFileName ? `${importedFileName.replace(/\.[^/.]+$/, '')}_enhanced.docx` : 'BulletBoost_Enhanced_Resume.docx'}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailStatus(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                onClick={handleSendEmail}
                disabled={isSendingEmail || !emailRecipient.trim()}
              >
                {isSendingEmail ? 'Sending via Resend...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {emailStatus && (
        <StatusIndicator
          type={emailStatus.type}
          message={emailStatus.message}
          className="mt-2"
        />
      )}

      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" onClick={onBack}>
          Back to Review
        </Button>
        <div className="flex gap-2">
          <Button
            id="copy-all-btn"
            variant="secondary"
            icon={<Copy className="w-4 h-4" />}
            onClick={handleCopyAll}
            disabled={accepted.length === 0}
          >
            {copiedAll ? 'Copied!' : 'Copy All'}
          </Button>
          <Button
            id="email-resume-btn"
            variant="outline"
            icon={<Mail className="w-4 h-4 text-forest" />}
            onClick={() => setShowEmailModal(!showEmailModal)}
            disabled={accepted.length === 0}
            title="Draft and send enhanced resume via Resend"
          >
            Email Resume
          </Button>
          <Button
            id="export-resume-btn"
            icon={<FileDown className="w-4 h-4" />}
            onClick={handleExportDocx}
            disabled={isExporting}
            title="Download enhanced resume as formatted DOCX document"
          >
            {isExporting ? 'Exporting...' : 'Export Resume (DOCX)'}
          </Button>
        </div>
      </div>
    </div>
  );
}
