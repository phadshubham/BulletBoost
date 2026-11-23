import React from 'react';
import { Target, Zap, ShieldCheck, ChevronDown, ChevronUp, Sparkles, AlertCircle, FileCheck, AlertTriangle } from 'lucide-react';
import type { AtsResumeScore } from '../../types';

interface AtsScoreGaugeProps {
  score: AtsResumeScore | null;
  baselineScore?: number | null;
  isLoading?: boolean;
}

export function AtsScoreGauge({ score, baselineScore, isLoading }: AtsScoreGaugeProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-border p-4 shadow-xs animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-neutral-200" />
          <div className="space-y-1.5">
            <div className="h-4 bg-neutral-200 rounded w-36" />
            <div className="h-3 bg-neutral-100 rounded w-52" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-16 h-8 bg-neutral-100 rounded-lg" />
          <div className="w-16 h-8 bg-neutral-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="bg-neutral-50 rounded-xl border border-dashed border-border p-4 text-center">
        <p className="text-xs text-muted">
          Evaluating resume sections against industry-standard ATS metrics...
        </p>
      </div>
    );
  }

  const overall = Math.round(score.overall_score);
  const delta = baselineScore !== undefined && baselineScore !== null ? Math.round(overall - baselineScore) : 0;

  // Color threshold (Industry standard bands: >=80 Top Match, >=60 Competitive, <60 Needs Work)
  let badgeColor = 'text-rose-700 bg-rose-50 border-rose-200';
  let ringColor = 'stroke-rose-500';
  let tierLabel = 'Needs Optimization';

  if (overall >= 75) {
    badgeColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    ringColor = 'stroke-emerald-500';
    tierLabel = 'Top Candidate Match';
  } else if (overall >= 55) {
    badgeColor = 'text-amber-700 bg-amber-50 border-amber-200';
    ringColor = 'stroke-amber-500';
    tierLabel = 'Competitive Candidate';
  }

  const brevity = score.brevity_score !== undefined ? Math.round(score.brevity_score) : 85;

  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-xs transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Main Score & Gauge */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-neutral-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${ringColor} transition-all duration-700`}
                strokeDasharray={`${overall}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-lg font-bold tracking-tight text-charcoal">{overall}</span>
              <span className="text-[9px] text-muted -mt-1">/100</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-charcoal text-[15px]">Industry ATS Score</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}>
                {tierLabel}
              </span>
              {delta > 0 && (
                <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Sparkles className="w-3 h-3" />
                  +{delta} pts uplift
                </span>
              )}
              {score.xyz_compliance_rate !== undefined && score.xyz_compliance_rate > 0 && (
                <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  {Math.round(score.xyz_compliance_rate)}% Google X-Y-Z
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-0.5">
              Based on {score.total_bullets_analyzed} bullets evaluated against industry standards & Job Description
            </p>
          </div>
        </div>

        {/* 4 Pillars Summary Bar */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap">
          <div className="flex flex-col items-center px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-100 min-w-[75px]">
            <span className="text-muted font-medium text-[10px] flex items-center gap-1">
              <Target className="w-3 h-3 text-indigo-500" /> Keywords (40%)
            </span>
            <span className="font-bold text-charcoal text-sm mt-0.5">{Math.round(score.keyword_score)}%</span>
          </div>

          <div className="flex flex-col items-center px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-100 min-w-[75px]">
            <span className="text-muted font-medium text-[10px] flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" /> Impact (30%)
            </span>
            <span className="font-bold text-charcoal text-sm mt-0.5">{Math.round(score.impact_score)}%</span>
          </div>

          <div className="flex flex-col items-center px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-100 min-w-[75px]">
            <span className="text-muted font-medium text-[10px] flex items-center gap-1">
              <FileCheck className="w-3 h-3 text-cyan-500" /> Brevity (15%)
            </span>
            <span className="font-bold text-charcoal text-sm mt-0.5">{brevity}%</span>
          </div>

          <div className="flex flex-col items-center px-2.5 py-1.5 rounded-lg bg-neutral-50 border border-neutral-100 min-w-[75px]">
            <span className="text-muted font-medium text-[10px] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" /> Format (15%)
            </span>
            <span className="font-bold text-charcoal text-sm mt-0.5">{Math.round(score.structure_score)}%</span>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 hover:bg-neutral-100 rounded-md text-muted hover:text-charcoal transition-colors ml-auto lg:ml-0"
            title="Toggle ATS breakdown details"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Breakdown Drawer */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <h4 className="font-semibold text-charcoal mb-1.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-600" /> Matched Skills & Keywords ({score.matched_keywords.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {score.matched_keywords.length > 0 ? (
                score.matched_keywords.map((kw) => (
                  <span key={kw} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                    ✓ {kw}
                  </span>
                ))
              ) : (
                <span className="text-muted italic">No target keywords matched yet.</span>
              )}
            </div>

            {score.missing_keywords.length > 0 && (
              <div className="mt-3">
                <h4 className="font-semibold text-amber-800 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Missing High-Priority Keywords ({score.missing_keywords.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {score.missing_keywords.map((kw) => (
                    <span key={kw} className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
                      + {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {score.buzzwords_detected && score.buzzwords_detected.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-rose-50/60 border border-rose-200 text-rose-800">
                <h5 className="font-semibold mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" /> Cliches & Buzzwords to Replace:
                </h5>
                <p className="text-[11px] leading-relaxed">
                  ATS scanners penalize vague fluff: <strong>{score.buzzwords_detected.join(', ')}</strong>. Replace with concrete accomplishments.
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-semibold text-charcoal mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-forest" /> Actionable ATS Optimization Steps
            </h4>
            <ul className="space-y-1.5">
              {score.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-muted-dark bg-neutral-50 p-2 rounded border border-neutral-100 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest mt-1.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
