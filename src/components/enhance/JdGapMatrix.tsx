import { Check, Plus, AlertCircle, Sparkles } from 'lucide-react';
import type { JdGapData } from '../../types';

interface JdGapMatrixProps {
  gapData: JdGapData | null;
  onAddFact: (skill: string) => void;
}

export function JdGapMatrix({ gapData, onAddFact }: JdGapMatrixProps) {
  if (!gapData) return null;

  return (
    <div className="bg-white rounded-xl border border-border p-4 text-xs shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-charcoal text-sm">Target JD Skills & Keywords Match</span>
          <span className="px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            {gapData.match_percentage}% Matched
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Matched Skills */}
        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
          <h5 className="font-semibold text-emerald-900 mb-1.5 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-600" /> Matched in Resume ({gapData.matched_skills.length})
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {gapData.matched_skills.length > 0 ? (
              gapData.matched_skills.map((skill) => (
                <span key={skill} className="px-2 py-0.5 rounded bg-white text-emerald-800 border border-emerald-200 text-[11px] font-medium shadow-2xs">
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-muted italic">No matching keywords detected yet.</span>
            )}
          </div>
        </div>

        {/* Missing Skills */}
        <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
          <h5 className="font-semibold text-amber-900 mb-1.5 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Missing from Resume ({gapData.missing_skills.length})
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {gapData.missing_skills.length > 0 ? (
              gapData.missing_skills.map((skill) => (
                <button
                  key={skill}
                  onClick={() => onAddFact(skill)}
                  className="px-2 py-0.5 rounded bg-white text-amber-900 border border-amber-200 text-[11px] font-medium hover:bg-amber-100 transition-colors flex items-center gap-1 shadow-2xs"
                  title="Click to add as verified supporting skill"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>{skill}</span>
                </button>
              ))
            ) : (
              <span className="text-emerald-800 font-medium">100% keyword coverage!</span>
            )}
          </div>
          {gapData.missing_skills.length > 0 && (
            <p className="text-[10px] text-amber-700/80 mt-2 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Click any skill you have used to truthfully verify it
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
