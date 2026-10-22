import { useState, useEffect } from 'react';
import {
  FlaskConical,
  Database,
  BarChart3,
  Info,
  CheckCircle2,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { Badge, DemoIndicator, Button } from '../components/ui';
import { getDemoEvalMetrics, type EvalMetrics } from '../data/demo';
import { getEvaluationMetrics } from '../services/api';
import type { EvaluationMetricsResponse } from '../types';

type ViewMode = 'overview' | 'details';

export function EvaluationPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [loading, setLoading] = useState(true);
  const [realMetrics, setRealMetrics] = useState<EvaluationMetricsResponse | null>(null);
  const [showDemoData, setShowDemoData] = useState(false);

  const fetchMetrics = () => {
    setLoading(true);
    getEvaluationMetrics()
      .then((data) => {
        if (data.available && data.metrics) {
          setRealMetrics(data);
          setShowDemoData(false);
        } else {
          setRealMetrics(null);
        }
      })
      .catch(() => {
        setRealMetrics(null);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let active = true;
    getEvaluationMetrics()
      .then((data) => {
        if (!active) return;
        if (data.available && data.metrics) {
          setRealMetrics(data);
          setShowDemoData(false);
        } else {
          setRealMetrics(null);
        }
      })
      .catch(() => {
        if (!active) return;
        setRealMetrics(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const hasRealData = realMetrics !== null && realMetrics.available && realMetrics.metrics;
  const demoMetrics: EvalMetrics = getDemoEvalMetrics();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <FlaskConical className="w-5 h-5 text-forest" />
            <h1 className="text-xl font-semibold text-charcoal">Evaluation Lab</h1>
            {hasRealData && !showDemoData && (
              <Badge variant="success" className="text-xs">
                Real Model v{realMetrics?.model_version || '1.0.0'}
              </Badge>
            )}
            {showDemoData && <DemoIndicator />}
          </div>
          <p className="text-sm text-muted">
            Performance metrics and validation reports for the custom resume bullet quality classifier.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasRealData && (
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={fetchMetrics}
              disabled={loading}
            >
              Refresh
            </Button>
          )}
          {hasRealData && !showDemoData && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDemoData(true)}
              className="text-xs"
            >
              View Demo Data
            </Button>
          )}
          {showDemoData && hasRealData && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDemoData(false)}
              className="text-xs"
            >
              Switch to Real Model Data
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-border rounded-lg p-12 text-center">
          <div className="w-8 h-8 border-2 border-forest border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted">Loading evaluation metrics from server...</p>
        </div>
      ) : showDemoData ? (
        /* Demo data view */
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DemoIndicator />
              <span className="text-xs text-muted">Sample data preview for UI prototyping</span>
            </div>
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'overview'
                    ? 'bg-forest text-white'
                    : 'bg-white text-muted hover:text-charcoal'
                }`}
                onClick={() => setViewMode('overview')}
              >
                Overview
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                  viewMode === 'details'
                    ? 'bg-forest text-white'
                    : 'bg-white text-muted hover:text-charcoal'
                }`}
                onClick={() => setViewMode('details')}
              >
                Details
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 bg-warning-bg rounded-md text-xs text-warning border border-amber-200">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              All values shown below are simulated sample figures for demonstration. They do not
              represent actual model evaluation.
            </span>
          </div>

          {viewMode === 'overview' ? (
            <DemoOverviewView metrics={demoMetrics} />
          ) : (
            <DemoDetailsView metrics={demoMetrics} />
          )}

          <div className="pt-2">
            <button
              onClick={() => setShowDemoData(false)}
              className="text-sm text-forest hover:underline font-medium transition-colors"
            >
              {hasRealData ? '← Return to real model evaluation' : '← Hide demo preview'}
            </button>
          </div>
        </div>
      ) : hasRealData ? (
        /* Real evaluation data view */
        <div className="space-y-5 animate-fade-in">
          {/* Header controls & real badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sage-light/40 border border-border/80 rounded-lg p-3">
            <div className="flex items-center gap-2 text-xs text-charcoal flex-wrap">
              <span className="flex items-center gap-1.5 font-medium text-forest">
                <CheckCircle2 className="w-4 h-4" /> Real Model Metrics
              </span>
              <span className="text-muted-light">•</span>
              <span className="text-muted font-mono">
                Model: {realMetrics.model_name || 'bullet_quality_classifier'} v
                {realMetrics.model_version || '1.0.0'}
              </span>
              <span className="text-muted-light">•</span>
              <span className="text-muted">
                Evaluated:{' '}
                {realMetrics.evaluation_timestamp
                  ? new Date(realMetrics.evaluation_timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Recent test run'}
              </span>
            </div>

            <div className="flex border border-border rounded-md overflow-hidden self-start sm:self-auto bg-white">
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'overview'
                    ? 'bg-forest text-white'
                    : 'bg-white text-muted hover:text-charcoal'
                }`}
                onClick={() => setViewMode('overview')}
              >
                Overview
              </button>
              <button
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${
                  viewMode === 'details'
                    ? 'bg-forest text-white'
                    : 'bg-white text-muted hover:text-charcoal'
                }`}
                onClick={() => setViewMode('details')}
              >
                Details
              </button>
            </div>
          </div>

          {viewMode === 'overview' ? (
            <RealOverviewView data={realMetrics} />
          ) : (
            <RealDetailsView data={realMetrics} />
          )}
        </div>
      ) : (
        /* Genuine empty state when model is not trained */
        <div className="bg-white border border-border rounded-lg p-10 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-sage flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6 text-forest" />
          </div>
          <h2 className="text-lg font-semibold text-charcoal mb-2">
            Evaluation Results Not Yet Available
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-4 leading-relaxed">
            The custom scikit-learn classifier model artifact has not been trained yet. To train the
            model and generate genuine test split evaluation metrics, run the reproducible training
            pipeline:
          </p>
          <div className="bg-neutral-900 text-neutral-100 font-mono text-xs p-3 rounded-md max-w-md mx-auto mb-6 text-left select-all">
            python backend/scripts/train_classifier.py
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={fetchMetrics}
            >
              Check Again
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Info className="w-3.5 h-3.5" />}
              onClick={() => setShowDemoData(true)}
            >
              View Demo Data Preview
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Real Model Overview View ──────────────────────────────────────────

function RealOverviewView({ data }: { data: EvaluationMetricsResponse }) {
  const metrics = data.metrics;
  const meta = data.dataset_metadata;
  if (!metrics || !meta) return null;

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Accuracy" value={formatPct(metrics.accuracy)} highlight="forest" />
        <MetricCard label="Macro Precision" value={formatPct(metrics.macro_precision)} />
        <MetricCard label="Macro Recall" value={formatPct(metrics.macro_recall)} />
        <MetricCard label="Macro F1-Score" value={formatPct(metrics.macro_f1)} highlight="forest" />
      </div>

      {/* Dataset information */}
      <div className="bg-white border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-forest" />
          <h3 className="text-sm font-semibold text-charcoal">Dataset Information & Splits</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-sage-light/30 rounded p-3">
            <p className="text-xs text-muted mb-0.5">Total Samples</p>
            <p className="text-xl font-bold text-charcoal">{meta.total_samples.toLocaleString()}</p>
            <p className="text-[11px] text-muted-light mt-0.5">Curated labeled bullet points</p>
          </div>
          <div className="bg-sage-light/30 rounded p-3">
            <p className="text-xs text-muted mb-0.5">Training Set</p>
            <p className="text-xl font-bold text-charcoal">{meta.train_samples.toLocaleString()}</p>
            <p className="text-[11px] text-muted-light mt-0.5">
              {Math.round((1 - meta.test_split_ratio) * 100)}% stratified split
            </p>
          </div>
          <div className="bg-sage-light/30 rounded p-3">
            <p className="text-xs text-muted mb-0.5">Held-Out Test Set</p>
            <p className="text-xl font-bold text-forest">{meta.test_samples.toLocaleString()}</p>
            <p className="text-[11px] text-muted-light mt-0.5">
              {Math.round(meta.test_split_ratio * 100)}% held-out unseen evaluation
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
            Class Distribution (Overall)
          </p>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(meta.overall_distribution).map(([label, count]) => (
              <Badge key={label} variant={label === 'strong' ? 'success' : label === 'adequate' ? 'info' : 'warning'}>
                {label.toUpperCase()}: {count} samples
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture & Pipeline */}
      <div className="bg-white border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="w-4 h-4 text-forest" />
          <h3 className="text-sm font-semibold text-charcoal">Model Architecture & Pipeline</h3>
        </div>
        <div className="text-sm text-muted space-y-2.5 leading-relaxed">
          <p>
            The classifier is a deterministic, reproducible scikit-learn Pipeline combining:{' '}
            <strong className="text-charcoal font-semibold">
              TF-IDF Feature Extraction
            </strong>{' '}
            (unigrams and bigrams, sublinear term-frequency scaling, maximum 2,500 features) with a{' '}
            <strong className="text-charcoal font-semibold">
              Logistic Regression Classifier
            </strong>{' '}
            (L2 regularization, balanced class weighting, L-BFGS solver).
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs font-mono text-muted">
            <span className="bg-neutral-100 px-2 py-1 rounded">scikit-learn: {data.scikit_learn_version || '1.9.0'}</span>
            <span className="bg-neutral-100 px-2 py-1 rounded">random_seed: {data.random_seed || 42}</span>
            <span className="bg-neutral-100 px-2 py-1 rounded">classes: weak, adequate, strong</span>
          </div>
        </div>
      </div>

      {/* Methodology & Limitations */}
      <div className="bg-white border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-charcoal mb-2">
          Methodology & Explicit Limitations
        </h3>
        <div className="text-xs text-muted space-y-2 leading-relaxed">
          <p>
            • <strong className="text-charcoal">Domain-Specific Rubric:</strong> The classifier learns strictly from annotations based on our written 3-tier rubric (action verbs, clarity, technical context, outcomes).
          </p>
          <p>
            • <strong className="text-charcoal">Partly Subjective:</strong> Resume quality is multidimensional and subjective. Quality classifications represent statistical heuristics, not absolute truths.
          </p>
          <p>
            • <strong className="text-charcoal">Synthetic Training Constraints:</strong> The starter dataset utilizes curated synthetic-grounded examples. Generalization to rare industry jargon may vary.
          </p>
          <p>
            • <strong className="text-charcoal">Not Factual Verification:</strong> A "Strong" prediction confirms high editorial quality and specificity; it does not verify that the user actually performed the work.
          </p>
          <p>
            • <strong className="text-charcoal">Not a Hiring Probability:</strong> The predicted score is an editorial heuristic, never a universal ATS score or guarantee of interview success.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Real Model Details View ───────────────────────────────────────────

function RealDetailsView({ data }: { data: EvaluationMetricsResponse }) {
  const metrics = data.metrics;
  if (!metrics) return null;

  return (
    <div className="space-y-5">
      {/* Confusion matrix */}
      <div className="bg-white border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-charcoal">
            Confusion Matrix (Held-Out Test Set)
          </h3>
          <span className="text-xs text-muted">
            Test size: {data.dataset_metadata?.test_samples || 0} samples
          </span>
        </div>
        <p className="text-xs text-muted mb-4">
          Diagonal cells highlight correct model predictions (true positives).
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-2.5 text-left text-xs text-muted font-medium bg-neutral-50/60 border border-border">
                  Actual ↓ / Predicted →
                </th>
                {metrics.class_labels.map((label) => (
                  <th
                    key={label}
                    className="p-2.5 text-center text-xs text-charcoal font-semibold uppercase bg-neutral-50/60 border border-border"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.confusion_matrix.map((row, i) => (
                <tr key={i}>
                  <td className="p-2.5 text-xs font-semibold uppercase text-charcoal bg-neutral-50/40 border border-border">
                    {metrics.class_labels[i]}
                  </td>
                  {row.map((val, j) => {
                    const isDiagonal = i === j;
                    return (
                      <td
                        key={j}
                        className={`p-3 text-center text-sm font-medium border border-border ${
                          isDiagonal
                            ? 'bg-green-50 text-forest font-bold'
                            : val > 0
                              ? 'bg-amber-50/50 text-amber-900'
                              : 'text-neutral-300'
                        }`}
                      >
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-class metrics table */}
      <div className="bg-white border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-charcoal mb-4">
          Per-Class Precision, Recall & F1-Score
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-neutral-50/60 border-b border-border">
                <th className="p-2.5 text-left text-xs text-muted font-medium">Category</th>
                <th className="p-2.5 text-right text-xs text-muted font-medium">Precision</th>
                <th className="p-2.5 text-right text-xs text-muted font-medium">Recall</th>
                <th className="p-2.5 text-right text-xs text-muted font-medium">F1-Score</th>
                <th className="p-2.5 text-right text-xs text-muted font-medium">Support (Test Samples)</th>
              </tr>
            </thead>
            <tbody>
              {metrics.class_labels.map((label) => {
                const pcm = metrics.per_class[label];
                if (!pcm) return null;
                return (
                  <tr key={label} className="border-t border-border">
                    <td className="p-2.5 text-xs font-semibold uppercase text-charcoal">
                      {label}
                    </td>
                    <td className="p-2.5 text-right text-sm font-mono">{formatPct(pcm.precision)}</td>
                    <td className="p-2.5 text-right text-sm font-mono">{formatPct(pcm.recall)}</td>
                    <td className="p-2.5 text-right text-sm font-mono font-semibold text-forest">
                      {formatPct(pcm.f1_score)}
                    </td>
                    <td className="p-2.5 text-right text-sm text-muted font-mono">{pcm.support}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Demo Overview View (for preview mode) ─────────────────────────────

function DemoOverviewView({ metrics }: { metrics: EvalMetrics }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Accuracy (Demo)" value={formatPct(metrics.accuracy)} />
        <MetricCard label="Precision (Demo)" value={formatPct(metrics.precision)} />
        <MetricCard label="Recall (Demo)" value={formatPct(metrics.recall)} />
        <MetricCard label="F1-Score (Demo)" value={formatPct(metrics.f1Score)} />
      </div>

      <div className="bg-white border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4 text-forest" />
          <h3 className="text-sm font-semibold text-charcoal">Sample Dataset Info (Simulated)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted mb-0.5">Total Samples</p>
            <p className="text-lg font-semibold text-charcoal">{metrics.datasetSize.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Training Set</p>
            <p className="text-lg font-semibold text-charcoal">{metrics.trainSize.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Test Set</p>
            <p className="text-lg font-semibold text-charcoal">{metrics.testSize.toLocaleString()}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted mb-2">Class Distribution</p>
          <div className="flex gap-3">
            {metrics.classDistribution.map((c) => (
              <Badge key={c.label} variant="info">
                {c.label}: {c.count}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Demo Details View (for preview mode) ──────────────────────────────

function DemoDetailsView({ metrics }: { metrics: EvalMetrics }) {
  return (
    <div className="space-y-5">
      <div className="bg-white border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-charcoal mb-4">
          Confusion Matrix (Sample Data Preview)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs text-muted font-medium">Actual ↓ / Predicted →</th>
                {metrics.classLabels.map((label) => (
                  <th key={label} className="p-2 text-center text-xs text-muted font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.confusionMatrix.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="p-2 text-xs font-medium text-charcoal">{metrics.classLabels[i]}</td>
                  {row.map((val, j) => (
                    <td
                      key={j}
                      className={`p-2 text-center text-sm font-medium ${
                        i === j ? 'bg-success-bg text-success' : val > 0 ? 'text-muted' : 'text-border-dark'
                      }`}
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'forest';
}) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 text-center">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className={`text-2xl font-bold ${highlight === 'forest' ? 'text-forest' : 'text-charcoal'}`}>
        {value}
      </p>
    </div>
  );
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
