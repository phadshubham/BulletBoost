import { useMemo } from 'react';

interface VisualDiffViewerProps {
  original: string;
  improved: string;
  className?: string;
}

// Tokenizes string into words and punctuation
function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) || [];
}

// Simple LCS (Longest Common Subsequence) diff on word tokens
function computeDiff(original: string, improved: string) {
  const origTokens = tokenize(original);
  const impTokens = tokenize(improved);

  // Filter out pure whitespace tokens for LCS matching
  const origWords = origTokens.filter((t) => /\S/.test(t));
  const impWords = impTokens.filter((t) => /\S/.test(t));

  const n = origWords.length;
  const m = impWords.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (origWords[i - 1].toLowerCase() === impWords[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find insertions, deletions, and common words
  let i = n;
  let j = m;
  const diffItems: { type: 'same' | 'added' | 'removed'; text: string }[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1].toLowerCase() === impWords[j - 1].toLowerCase()) {
      diffItems.unshift({ type: 'same', text: impWords[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffItems.unshift({ type: 'added', text: impWords[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diffItems.unshift({ type: 'removed', text: origWords[i - 1] });
      i--;
    }
  }

  return diffItems;
}

export function VisualDiffViewer({ original, improved, className = '' }: VisualDiffViewerProps) {
  const diff = useMemo(() => computeDiff(original, improved), [original, improved]);

  const isMetric = (word: string) => /\d+(?:[\.,]\d+)?%?|\$|x\b/i.test(word);

  return (
    <div className={`p-3 rounded-lg bg-neutral-50/80 border border-neutral-200 text-sm leading-relaxed ${className}`}>
      <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        <span>Inline Word-Level Changes:</span>
        <span className="line-through text-rose-500 bg-rose-50 px-1 rounded text-[11px]">Removed</span>
        <span className="text-emerald-700 bg-emerald-50 font-semibold px-1 rounded text-[11px]">Enhanced</span>
      </div>

      <div className="flex flex-wrap gap-x-1.5 gap-y-1 items-baseline">
        {diff.map((item, idx) => {
          if (item.type === 'removed') {
            return (
              <span
                key={idx}
                className="line-through text-rose-500/80 bg-rose-50/60 px-1 py-0.5 rounded text-[13px]"
                title="Removed from original"
              >
                {item.text}
              </span>
            );
          }
          if (item.type === 'added') {
            return (
              <span
                key={idx}
                className="font-semibold text-emerald-800 bg-emerald-100/70 px-1 py-0.5 rounded text-[13px] border border-emerald-200/60"
                title="Newly added active phrasing / keyword"
              >
                {item.text}
              </span>
            );
          }
          // Preserved words
          if (isMetric(item.text)) {
            return (
              <span
                key={idx}
                className="font-bold text-amber-900 bg-amber-100/70 px-1 py-0.5 rounded text-[13px] border border-amber-200"
                title="Preserved verified metric"
              >
                {item.text}
              </span>
            );
          }
          return (
            <span key={idx} className="text-charcoal text-[13px]">
              {item.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
