// Client-side instant ATS calculator for 0ms UI feedback aligned with Industry Standards

const KEYWORD_LIST = [
  'python', 'javascript', 'typescript', 'java', 'c++', 'golang', 'go', 'rust',
  'react', 'react native', 'vue', 'angular', 'svelte', 'next.js', 'node.js', 'express',
  'django', 'fastapi', 'flask', 'spring boot', 'graphql', 'rest', 'grpc', 'websocket',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'kafka', 'rabbitmq',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'k8s', 'terraform', 'ci/cd', 'github actions',
  'jenkins', 'linux', 'microservices', 'distributed systems', 'system design', 'scalability',
  'latency', 'sql', 'nosql', 'machine learning', 'deep learning', 'artificial intelligence',
  'llm', 'generative ai', 'rag', 'langchain', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas',
  'agile', 'scrum', 'jira', 'git', 'oauth', 'security', 'prometheus', 'grafana', 'datadog'
];

const TIER_1_ACTION_VERBS = new Set([
  'accelerated', 'achieved', 'analyzed', 'architected', 'automated', 'built',
  'championed', 'consolidated', 'decreased', 'delivered', 'deployed', 'designed',
  'developed', 'eliminated', 'engineered', 'established', 'executed', 'expanded',
  'expedited', 'formulated', 'founded', 'generated', 'implemented', 'improved', 'increased',
  'initiated', 'instituted', 'integrated', 'launched', 'maximized', 'mentored', 'modernized',
  'negotiated', 'optimized', 'orchestrated', 'overhauled', 'partnered', 'pioneered', 'produced',
  'reduced', 'refactored', 'resolved', 'revamped', 'saved', 'scaled', 'slashed', 'spearheaded',
  'standardized', 'streamlined', 'surpassed', 'transformed', 'unified', 'upgraded', 'authored',
  'programmed', 'devised', 'boosted', 'doubled', 'tripled', 'secured'
]);

const WEAK_VERBS = new Set([
  'assisted', 'worked on', 'helped', 'participated', 'handled', 'was responsible for',
  'responsible for', 'did', 'tasked with', 'supported', 'contributed', 'involved in',
  'attempted', 'tried', 'learned', 'familiar with'
]);

const BUZZWORDS = [
  'hardworking', 'go-getter', 'team player', 'detail-oriented', 'synergy',
  'think outside the box', 'results-driven', 'self-starter', 'dynamic', 'passionate'
];

export function calculateBulletScoreLocal(text: string): {
  score: number;
  verb: string | null;
  verbTier: 'strong' | 'weak' | 'neutral';
  metricsCount: number;
  wordCount: number;
  isOrphan: boolean;
  isXyz: boolean;
  buzzwords: string[];
} {
  if (!text || !text.trim()) {
    return { score: 0, verb: null, verbTier: 'neutral', metricsCount: 0, wordCount: 0, isOrphan: false, isXyz: false, buzzwords: [] };
  }

  const clean = text.trim();
  const words = clean.split(/\s+/);
  const wordCount = words.length;

  // Verb detection
  const firstWord = words[0].toLowerCase().replace(/[^a-z]/g, '');
  const twoWord = words.slice(0, 2).join(' ').toLowerCase();

  let verbTier: 'strong' | 'weak' | 'neutral' = 'neutral';
  let verbScore = 15;

  if (WEAK_VERBS.has(twoWord) || WEAK_VERBS.has(firstWord)) {
    verbTier = 'weak';
    verbScore = 5;
  } else if (TIER_1_ACTION_VERBS.has(firstWord)) {
    verbTier = 'strong';
    verbScore = 30;
  }

  // Metrics detection (numbers, %, $, k, etc.) - Excluding 4-digit years 1970-2099
  const rawMetrics = clean.match(
    /(\$\s*\d+(?:[\.,]\d+)?\s*(?:k|m|b)?|\b\d+(?:[\.,]\d+)?\s*(?:%|\+|x|k|m|ms|s|qps|tps|users|req\/s|rps)?\b)/gi
  ) || [];
  const metricsMatches = rawMetrics.filter((m) => {
    const s = m.trim();
    if (/^(?:19[7-9]\d|20[0-9]\d)$/.test(s)) return false;
    if (/^[0-9]$/.test(s)) return false;
    return true;
  });
  const metricsCount = metricsMatches.length;
  const metricScore = Math.min(35, metricsCount * 18);

  // Keyword presence
  const lower = clean.toLowerCase();
  const kwMatches = KEYWORD_LIST.filter((kw) => lower.includes(kw));
  const kwScore = Math.min(20, kwMatches.length * 7);

  // Length score
  let lengthScore = 15;
  if (wordCount < 10 || wordCount > 45) {
    lengthScore = 5;
  }

  // Buzzword check
  const detectedBuzzwords = BUZZWORDS.filter((bw) => lower.includes(bw));
  if (detectedBuzzwords.length > 0) {
    lengthScore = Math.max(0, lengthScore - detectedBuzzwords.length * 3);
  }

  const isOrphan = wordCount > 15 && words[words.length - 1].length <= 5 && (words[words.length - 2]?.length || 0) <= 4;
  const isXyz = verbTier === 'strong' && metricsCount > 0 && wordCount >= 12;

  const totalScore = Math.min(100, Math.max(15, verbScore + metricScore + kwScore + lengthScore));

  return {
    score: Math.round(totalScore),
    verb: firstWord,
    verbTier,
    metricsCount,
    wordCount,
    isOrphan,
    isXyz,
    buzzwords: detectedBuzzwords,
  };
}

export function calculateDeltaLocal(original: string, improved: string) {
  const orig = calculateBulletScoreLocal(original);
  const imp = calculateBulletScoreLocal(improved);
  const delta = Math.round(imp.score - orig.score);

  const breakdown: string[] = [];
  if (orig.verbTier !== 'strong' && imp.verbTier === 'strong') {
    breakdown.push(`Upgraded to Tier-1 active verb '${imp.verb}' (+15 pts)`);
  }
  if (imp.metricsCount > orig.metricsCount) {
    breakdown.push(`Added verified quantifiable metric / outcome (+${(imp.metricsCount - orig.metricsCount) * 15} pts)`);
  }
  if (!orig.isXyz && imp.isXyz) {
    breakdown.push('Achieved Google X-Y-Z formula compliance (+10 pts)');
  }
  if (orig.wordCount < 10 && imp.wordCount >= 14) {
    breakdown.push('Expanded minimal bullet into full-scope accomplishment (+10 pts)');
  } else if (orig.wordCount > 40 && imp.wordCount <= 35) {
    breakdown.push('Condensed dense paragraph into clean single-line bullet (+5 pts)');
  }
  if (orig.buzzwords.length > imp.buzzwords.length) {
    breakdown.push(`Removed vague cliches: ${orig.buzzwords.join(', ')} (+5 pts)`);
  }

  return {
    delta,
    origScore: orig.score,
    impScore: imp.score,
    breakdown,
    wordCount: imp.wordCount,
    isOrphan: imp.isOrphan,
    isXyz: imp.isXyz,
  };
}
