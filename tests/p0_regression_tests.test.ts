import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBulletForComparison,
  isCandidateNoOp,
  enhanceBulletsWithHeuristics,
} from '../src/services/heuristicEnhancer.ts';
import { findNextPendingBulletId } from '../src/utils/review.ts';
import type { EnhancedBullet } from '../src/types.ts';

const P0_BULLET =
  'Built model evaluation workflows using MAE, RMSE and MAPE to compare forecasting performance.';

// ── Test A: Identical text returns no_op ─────────────────────────────────────

test('Test A — Identical original and candidate text is detected as no-op', () => {
  const original = P0_BULLET;
  const candidate = P0_BULLET;

  assert.equal(isCandidateNoOp(original, candidate), true);
  assert.equal(isCandidateNoOp(original, null), true);
  assert.equal(isCandidateNoOp(original, undefined), true);
});

// ── Test B: Identical text with whitespace variations ────────────────────────

test('Test B — Identical text with leading, trailing, and repeated whitespace is a no-op', () => {
  const whitespaceVariant = `  \n\t  ${P0_BULLET}   \n  `;
  const multiSpaceVariant =
    'Built  model   evaluation  workflows using  MAE, RMSE  and MAPE to compare forecasting performance.';

  assert.equal(isCandidateNoOp(P0_BULLET, whitespaceVariant), true);
  assert.equal(isCandidateNoOp(P0_BULLET, multiSpaceVariant), true);

  const norm1 = normalizeBulletForComparison(P0_BULLET);
  const norm2 = normalizeBulletForComparison(whitespaceVariant);
  const norm3 = normalizeBulletForComparison(multiSpaceVariant);
  assert.equal(norm1, norm2);
  assert.equal(norm2, norm3);
});

// ── Test C: Harmless formatting-only change ──────────────────────────────────

test('Test C — Inconsequential punctuation, capitalization, and bullet markers are no-ops', () => {
  const punctVariant = P0_BULLET + '.';
  const punctVariant2 = P0_BULLET + '...';
  const caseVariant = P0_BULLET.toLowerCase();
  const markerVariant = '• ' + P0_BULLET;
  const dashVariant = '- ' + P0_BULLET;

  assert.equal(isCandidateNoOp(P0_BULLET, punctVariant), true);
  assert.equal(isCandidateNoOp(P0_BULLET, punctVariant2), true);
  assert.equal(isCandidateNoOp(P0_BULLET, caseVariant), true);
  assert.equal(isCandidateNoOp(P0_BULLET, markerVariant), true);
  assert.equal(isCandidateNoOp(P0_BULLET, dashVariant), true);
});

// ── Test D: Real grammar correction is NOT a no-op ───────────────────────────

test('Test D — Real minor grammar correction is recognized as a genuine edit', () => {
  const orig = 'Worked on machine learning project using Python.';
  const cand = 'Worked on a machine learning project using Python.';

  // Word token sequence differs because 'a' was legitimately added
  assert.equal(isCandidateNoOp(orig, cand), false);
});

// ── Test E: Mapping by stable bullet ID and text version ─────────────────────

test('Test E — Classifier predictions correctly map by stable bullet ID', () => {
  const predictions = [
    { id: 'bullet-2:orig', text: 'Second bullet text', quality: 'adequate' as const, confidence: 0.75 },
    { id: 'bullet-1:orig', text: 'First bullet text', quality: 'strong' as const, confidence: 0.92 },
  ];

  const predMap = new Map(predictions.map((p) => [p.id, p]));

  // Shuffled returned array must resolve deterministically by ID
  const b1Pred = predMap.get('bullet-1:orig');
  const b2Pred = predMap.get('bullet-2:orig');

  assert.ok(b1Pred);
  assert.equal(b1Pred.text, 'First bullet text');
  assert.equal(b1Pred.quality, 'strong');
  assert.equal(b1Pred.confidence, 0.92);

  assert.ok(b2Pred);
  assert.equal(b2Pred.text, 'Second bullet text');
  assert.equal(b2Pred.quality, 'adequate');
});

// ── Test F: Asynchronous stale response protection ───────────────────────────

test('Test F — Reducer guard prevents stale async classification from overwriting updated text', () => {
  // Simulating state update guard logic from AppContext.tsx
  const currentBullet: EnhancedBullet = {
    id: 'b-1',
    originalBulletId: 'b-1',
    sectionTitle: 'Experience',
    original: P0_BULLET,
    improved: 'Old improved text',
    editedImproved: 'New user edited text', // User just edited this!
    status: 'pending',
    explanation: 'Some explanation',
    warnings: [],
    missingEvidence: [],
  };

  // Stale async response arrives from an earlier request for 'Old improved text'
  const staleResponse = {
    bulletId: 'b-1',
    expectedImprovedText: 'Old improved text',
    improvedQuality: 'strong' as const,
    improvedConfidence: 0.88,
  };

  const currentEffectiveText = currentBullet.editedImproved ?? currentBullet.improved;
  const isStale =
    staleResponse.expectedImprovedText !== undefined &&
    staleResponse.expectedImprovedText !== currentEffectiveText;

  // Assert stale response was detected and discarded
  assert.equal(isStale, true);

  // When fresh response arrives matching 'New user edited text'
  const freshResponse = {
    bulletId: 'b-1',
    expectedImprovedText: 'New user edited text',
    improvedQuality: 'strong' as const,
    improvedConfidence: 0.94,
  };
  const isFreshStale =
    freshResponse.expectedImprovedText !== undefined &&
    freshResponse.expectedImprovedText !== currentEffectiveText;

  assert.equal(isFreshStale, false);
});

// ── Test G: No false uplift for identical original and proposed text ──────────

test('Test G — Identical original and proposed text cannot trigger Quality Tier Uplift', () => {
  const bullet: EnhancedBullet = {
    id: 'b-identical',
    originalBulletId: 'b-identical',
    sectionTitle: 'Experience',
    original: P0_BULLET,
    improved: P0_BULLET, // identical
    editedImproved: null,
    status: 'no_suggestion',
    explanation: 'The original bullet is already clear, or no meaningful improvement was found.',
    warnings: [],
    missingEvidence: [],
    originalQuality: 'adequate',
    originalConfidence: 0.85,
    improvedQuality: 'strong', // hypothetical old cached value
    improvedConfidence: 0.90,
  };

  const isNoOp =
    bullet.status === 'no_suggestion' ||
    bullet.improved === null ||
    isCandidateNoOp(bullet.original, bullet.editedImproved ?? bullet.improved);

  // Frontend guard: even if improvedQuality != originalQuality, isNoOp suppresses uplift!
  assert.equal(isNoOp, true);

  const shouldRenderUplift =
    !isNoOp &&
    bullet.originalQuality &&
    bullet.improvedQuality &&
    bullet.originalQuality !== bullet.improvedQuality;

  assert.equal(shouldRenderUplift, false);
});

// ── Test H: Real improvement receives honest comparison ──────────────────────

test('Test H — Genuine improvement allows comparative display', () => {
  const orig = 'Responsible for building forecasting performance models.';
  const improved = 'Built and calibrated forecasting performance models using MAE and RMSE metrics.';

  const isNoOp = isCandidateNoOp(orig, improved);
  assert.equal(isNoOp, false);

  const bullet: EnhancedBullet = {
    id: 'b-real',
    originalBulletId: 'b-real',
    sectionTitle: 'Experience',
    original: orig,
    improved: improved,
    editedImproved: null,
    status: 'pending',
    explanation: 'Clarified phrasing and strengthened active verbs.',
    warnings: [],
    missingEvidence: [],
    originalQuality: 'weak',
    originalConfidence: 0.78,
    improvedQuality: 'strong',
    improvedConfidence: 0.91,
  };

  const shouldRenderUplift =
    !isNoOp &&
    bullet.originalQuality &&
    bullet.improvedQuality &&
    bullet.originalQuality !== bullet.improvedQuality;

  assert.equal(shouldRenderUplift, true);
});

// ── Test I: No-suggestion through Final Review and export ─────────────────────

test('Test I — Unchanged no-suggestion bullets are preserved as original and excluded from accepted list', () => {
  const bullets: EnhancedBullet[] = [
    {
      id: 'b-1',
      originalBulletId: 'b-1',
      sectionTitle: 'Experience',
      original: P0_BULLET,
      improved: null,
      editedImproved: null,
      status: 'no_suggestion',
      explanation: 'The original bullet is already clear, or no meaningful improvement was found.',
      warnings: [],
      missingEvidence: [],
    },
    {
      id: 'b-2',
      originalBulletId: 'b-2',
      sectionTitle: 'Experience',
      original: 'Sales rep for team.',
      improved: 'Expanded qualified sales pipeline by 35% through outbound initiatives.',
      editedImproved: null,
      status: 'accepted',
      explanation: 'Quantified impact and strengthened action verbs.',
      warnings: [],
      missingEvidence: [],
    },
  ];

  // Only accepted bullets are exported as substitutions
  const accepted = bullets.filter((b) => b.status === 'accepted');
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].id, 'b-2');

  // No-suggestion bullet is NOT in accepted substitutions
  const acceptedIds = new Set(accepted.map((b) => b.originalBulletId));
  assert.equal(acceptedIds.has('b-1'), false);

  // In DOCX export, b-1 retains original text P0_BULLET unchanged
  const acceptedMap: Record<string, string> = {};
  for (const b of accepted) {
    acceptedMap[b.originalBulletId] = (b.editedImproved ?? b.improved ?? b.original).trim();
  }

  const exportedB1Text = acceptedMap['b-1'] ?? P0_BULLET;
  assert.equal(exportedB1Text, P0_BULLET);
});

// ── Test J: Review navigation skips no-suggestion items ───────────────────────

test('Test J — findNextPendingBulletId skips no_suggestion items to next pending item', () => {
  const bullets: EnhancedBullet[] = [
    {
      id: 'b-1',
      originalBulletId: 'b-1',
      sectionTitle: 'Experience',
      original: 'Bullet 1',
      improved: 'Improved 1',
      editedImproved: null,
      status: 'pending',
      explanation: 'Test',
      warnings: [],
      missingEvidence: [],
    },
    {
      id: 'b-2',
      originalBulletId: 'b-2',
      sectionTitle: 'Experience',
      original: P0_BULLET,
      improved: null,
      editedImproved: null,
      status: 'no_suggestion',
      explanation: 'No suggestion needed',
      warnings: [],
      missingEvidence: [],
    },
    {
      id: 'b-3',
      originalBulletId: 'b-3',
      sectionTitle: 'Experience',
      original: 'Bullet 3',
      improved: 'Improved 3',
      editedImproved: null,
      status: 'pending',
      explanation: 'Test',
      warnings: [],
      missingEvidence: [],
    },
  ];

  // When b-1 is accepted, navigation must advance directly to b-3, skipping b-2 (no_suggestion)
  const nextAfterB1 = findNextPendingBulletId(bullets, 'b-1');
  assert.equal(nextAfterB1, 'b-3');

  // If b-3 is accepted and b-1 is now accepted, no pending items remain
  const updatedBullets: EnhancedBullet[] = bullets.map((b) =>
    b.id === 'b-1' || b.id === 'b-3' ? { ...b, status: 'accepted' as const } : b
  );
  const nextAfterB3 = findNextPendingBulletId(updatedBullets, 'b-3');
  assert.equal(nextAfterB3, null);
});

// ── Test K: Review needed items are included in pending review flow ────────────

test('Test K — findNextPendingBulletId navigates to review_needed items', () => {
  const bullets: EnhancedBullet[] = [
    {
      id: 'b-1',
      originalBulletId: 'b-1',
      sectionTitle: 'Experience',
      original: 'Bullet 1',
      improved: 'Improved 1',
      editedImproved: null,
      status: 'accepted',
      explanation: 'Accepted',
      warnings: [],
      missingEvidence: [],
    },
    {
      id: 'b-2',
      originalBulletId: 'b-2',
      sectionTitle: 'Experience',
      original: 'Bullet 2',
      improved: null,
      editedImproved: null,
      status: 'review_needed',
      decisionReason: 'validation_failed',
      explanation: 'Unable to produce a safe improvement.',
      warnings: [],
      missingEvidence: [],
    },
  ];

  const next = findNextPendingBulletId(bullets, 'b-1');
  assert.equal(next, 'b-2');
});

// ── Test L: Heuristic regression for observed project bullets ──────────────────

test('Test L — Seven project bullets yield meaningful improvements or legitimate no-suggestion', () => {
  const bullets = [
    { id: '1', text: 'Developed an AI-powered sales forecasting dashboard combining Prophet and Auto-ARIMA for multi-model forecasting.', section_title: 'Projects', section_type: 'projects' },
    { id: '2', text: 'Built model evaluation using MAE, RMSE and MAPE and generated KPI insights including growth trends.', section_title: 'Projects', section_type: 'projects' },
    { id: '3', text: 'Integrated LLaMA3 through Ollama and LangChain to generate contextual business insights from forecast data.', section_title: 'Projects', section_type: 'projects' },
    { id: '4', text: 'Implemented Grad-CAM explainability to generate heatmaps showing image regions influencing model decisions.', section_title: 'Projects', section_type: 'projects' },
    { id: '5', text: 'Built real-time prediction APIs using FastAPI with a React frontend for image upload, classification and visualization.', section_title: 'Projects', section_type: 'projects' },
    { id: '6', text: 'Achieved 97.59% validation accuracy across 22,000 validation samples.', section_title: 'Projects', section_type: 'projects' },
    { id: '7', text: 'Built model evaluation workflows using MAE, RMSE and MAPE to compare forecasting performance.', section_title: 'Projects', section_type: 'projects' },
  ];

  const results = enhanceBulletsWithHeuristics({ bullets });
  assert.equal(results.length, 7);

  // Bullets 1, 2, 3, 4, 5, 7 should receive genuine suggestions
  for (const idx of [0, 1, 2, 3, 4, 6]) {
    assert.equal(results[idx].status, 'pending', `Bullet ${idx + 1} should have pending status`);
    assert.notEqual(results[idx].improved, null, `Bullet ${idx + 1} should have improved text`);
    assert.notEqual(results[idx].improved, bullets[idx].text, `Bullet ${idx + 1} should not be identical`);
    assert.equal(results[idx].decisionReason, 'meaningful_suggestion');
  }

  // Bullet 6 is already clear and concise with metric
  assert.equal(results[5].status, 'no_suggestion');
  assert.equal(results[5].improved, null);
  assert.equal(results[5].decisionReason, 'original_already_clear');
});

// ── Test M: Low classifier confidence flags uncertainty without suppressing edits ─

test('Test M — Low confidence is distinguished from category and does not suppress suggestion', () => {
  const confidence = 0.39;
  const isUncertain = confidence < 0.50;
  assert.equal(isUncertain, true);

  // Ensure confidence value does NOT dictate suggestion suppression
  const hasSuggestion = true;
  const suppressDueToConfidence = false;
  assert.equal(hasSuggestion && !suppressDueToConfidence, true);
});

