import { useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileText,
  CheckSquare,
  Square,
  MinusSquare,
  AlertTriangle,
  ArrowLeft,
  Server,
} from 'lucide-react';
import { Button, Badge, DemoIndicator } from '../ui';
import { useAppState, useAppDispatch } from '../../context/AppContext';

export function SectionAnalysis() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  const stats = useMemo(() => {
    const totalSections = state.sections.length;
    const selectedSections = state.sections.filter((s) => s.selected).length;
    const totalBullets = state.sections.reduce(
      (sum, s) => sum + s.bullets.length,
      0
    );
    const selectedBullets = state.sections.reduce(
      (sum, s) => sum + s.bullets.filter((b) => b.selected).length,
      0
    );
    return { totalSections, selectedSections, totalBullets, selectedBullets };
  }, [state.sections]);

  const allSelected =
    state.sections.length > 0 && state.sections.every((s) => s.selected);

  const canContinue = stats.selectedBullets > 0;

  const handleContinue = () => {
    dispatch({ type: 'SET_STEP', step: 'preferences' });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_STEP', step: 'import' });
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-xl font-semibold text-charcoal">
              Resume Analysis
            </h2>
            {state.isDemo ? (
              <DemoIndicator />
            ) : (
              <Badge variant="success" className="gap-1 flex items-center">
                <Server className="w-3 h-3" />
                Parsed by Backend
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted">
            Select the sections and bullets you want to enhance.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="flex items-center gap-1.5 font-medium text-charcoal">
            <FileText className="w-4 h-4 text-forest" />
            {state.importedFile?.name ?? (state.isDemo ? 'sample_resume.txt' : 'pasted_resume.txt')}
          </span>
        </div>
      </div>

      {/* Parsing warnings if any */}
      {state.parsingWarnings && state.parsingWarnings.length > 0 && (
        <div className="mb-5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 animate-fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-xs text-amber-950 uppercase tracking-wider">
                Parser Notice
              </p>
              {state.parsingWarnings.map((warning, idx) => (
                <p key={idx} className="text-xs text-amber-800 leading-relaxed">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {state.sections.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-border rounded-lg bg-sage-light/30">
          <FileText className="w-10 h-10 text-muted mx-auto mb-3" />
          <h3 className="text-base font-medium text-charcoal mb-1">
            No Resume Sections Detected
          </h3>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">
            We were unable to detect readable sections or bullet items from this document.
            Please verify the file has selectable text (not scanned images) or try pasting the raw text.
          </p>
          <Button variant="outline" onClick={handleBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Return to Import
          </Button>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex flex-wrap items-center gap-3 mb-5 p-3 bg-sage-light rounded-md">
            <Badge variant="info">
              {stats.totalSections} sections detected
            </Badge>
            <Badge variant="info">
              {stats.totalBullets} bullet points
            </Badge>
            <Badge variant={canContinue ? 'success' : 'default'}>
              {stats.selectedBullets} selected for enhancement
            </Badge>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  dispatch({
                    type: 'SELECT_ALL_SECTIONS',
                    selected: !allSelected,
                  })
                }
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
          </div>

          {/* Section list */}
          <div className="space-y-2">
            {state.sections.map((section) => {
              const selectedCount = section.bullets.filter((b) => b.selected).length;
              const allBulletsSelected =
                section.bullets.length > 0 && section.bullets.every((b) => b.selected);
              const someBulletsSelected =
                section.bullets.some((b) => b.selected) && !allBulletsSelected;

              return (
                <div
                  key={section.id}
                  className="border border-border rounded-lg bg-white overflow-hidden shadow-xs"
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-neutral-50/60 transition-colors">
                    {/* Checkbox */}
                    <button
                      className="flex-shrink-0 text-muted hover:text-forest transition-colors focus-ring rounded"
                      onClick={() =>
                        dispatch({
                          type: 'TOGGLE_SECTION_SELECTED',
                          sectionId: section.id,
                        })
                      }
                      aria-label={`${section.selected ? 'Deselect' : 'Select'} ${section.title}`}
                    >
                      {allBulletsSelected ? (
                        <CheckSquare className="w-5 h-5 text-forest" />
                      ) : someBulletsSelected ? (
                        <MinusSquare className="w-5 h-5 text-forest" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    {/* Expand/collapse toggle */}
                    <button
                      className="flex-1 flex items-center gap-2 min-w-0 text-left focus-ring rounded"
                      onClick={() =>
                        dispatch({
                          type: 'TOGGLE_SECTION_EXPANDED',
                          sectionId: section.id,
                        })
                      }
                      aria-expanded={section.expanded}
                      aria-label={`${section.expanded ? 'Collapse' : 'Expand'} ${section.title}`}
                    >
                      {section.expanded ? (
                        <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-charcoal truncate">
                        {section.title}
                      </span>
                      <span className="text-xs uppercase tracking-wider text-muted font-mono bg-sage-light px-1.5 py-0.5 rounded ml-1">
                        {section.type}
                      </span>
                    </button>

                    {/* Bullet counter */}
                    <span className="text-xs text-muted flex-shrink-0">
                      {selectedCount}/{section.bullets.length} selected
                    </span>
                  </div>

                  {/* Bullet list */}
                  {section.expanded && (
                    <div className="border-t border-border px-4 py-3 space-y-2 bg-neutral-50/40">
                      {section.bullets.length === 0 ? (
                        <p className="text-xs text-muted italic py-1">
                          No distinct bullet points extracted in this section.
                        </p>
                      ) : (
                        section.bullets.map((bullet) => (
                          <div
                            key={bullet.id}
                            className="flex items-start gap-2.5 py-1 text-sm group"
                          >
                            <button
                              className="flex-shrink-0 mt-0.5 text-muted hover:text-forest transition-colors focus-ring rounded"
                              onClick={() =>
                                dispatch({
                                  type: 'TOGGLE_BULLET_SELECTED',
                                  sectionId: section.id,
                                  bulletId: bullet.id,
                                })
                              }
                              aria-label={`${bullet.selected ? 'Deselect' : 'Select'} bullet`}
                            >
                              {bullet.selected ? (
                                <CheckSquare className="w-4 h-4 text-forest" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                            <span
                              className={`
                                flex-1 leading-relaxed text-xs sm:text-sm
                                ${bullet.selected ? 'text-charcoal font-normal' : 'text-muted/70'}
                              `}
                            >
                              {bullet.text}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={handleBack}>
              Back
            </Button>
            <div className="flex items-center gap-3">
              {!canContinue && (
                <span className="text-xs text-muted">
                  Select at least one bullet to continue
                </span>
              )}
              <Button onClick={handleContinue} disabled={!canContinue} size="lg">
                Continue to Preferences
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
