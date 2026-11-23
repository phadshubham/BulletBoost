import { useState } from 'react';
import { Sparkles, Send, X, Lightbulb } from 'lucide-react';
import { Button } from '../ui';

interface EvidenceInterviewerProps {
  bulletText: string;
  onAddEvidence: (evidence: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function EvidenceInterviewer({
  bulletText,
  onAddEvidence,
  isOpen,
  onClose,
}: EvidenceInterviewerProps) {
  const [evidenceInput, setEvidenceInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceInput.trim()) return;
    onAddEvidence(evidenceInput.trim());
    setEvidenceInput('');
    onClose();
  };

  return (
    <div className="mt-3 p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs transition-all animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
            <Lightbulb className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-indigo-950 text-sm">
              Don't Hallucinate — Add Verified Context
            </h4>
            <p className="text-indigo-800/80 text-xs">
              BulletBoost prohibits the AI from inventing fake metrics. Tell us what happened in casual words, and we'll weave it in:
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-indigo-700/60 hover:text-indigo-950 rounded hover:bg-indigo-100 transition-colors"
          title="Close context prompt"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 p-2 bg-white/80 rounded-lg border border-indigo-100 text-muted-dark italic">
        Original: "{bulletText}"
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <div className="relative">
          <textarea
            value={evidenceInput}
            onChange={(e) => setEvidenceInput(e.target.value)}
            placeholder="e.g. We reduced database queries by 45%, used Redis caching, handled 20k daily active users, or saved the team 5 hours a week..."
            rows={2}
            className="w-full text-xs p-2.5 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-charcoal placeholder:text-muted"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-indigo-700/80 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-indigo-600" />
            Verified facts stay 100% truthful and boost your ATS score
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} className="h-7 text-xs">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!evidenceInput.trim()}
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Incorporate Evidence
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
