import { AlertTriangle, Scissors } from 'lucide-react';

interface PageBudgetWarningProps {
  wordCount: number;
  isOrphan?: boolean;
  onTighten?: () => void;
}

export function PageBudgetWarning({ wordCount, isOrphan, onTighten }: PageBudgetWarningProps) {
  if (!isOrphan && wordCount <= 42) return null;

  return (
    <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        {isOrphan ? (
          <span>
            <strong>Orphan Word Risk:</strong> This bullet ends with a 1-2 word dangling line that wastes vertical space on a 1-page resume.
          </span>
        ) : (
          <span>
            <strong>Length Warning:</strong> {wordCount} words may span 3+ lines. Consider tightening for 1-page ATS budgeting.
          </span>
        )}
      </div>

      {onTighten && (
        <button
          onClick={onTighten}
          className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors shrink-0"
        >
          <Scissors className="w-3 h-3" />
          <span>Tighten</span>
        </button>
      )}
    </div>
  );
}
