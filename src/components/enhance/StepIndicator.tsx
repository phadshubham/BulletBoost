import { Check, LayoutDashboard } from 'lucide-react';
import type { AppStep } from '../../types';
import { useAppState, useAppDispatch } from '../../context/AppContext';

interface StepIndicatorProps {
  currentStep: AppStep;
}

const steps: { key: AppStep; label: string; number: number }[] = [
  { key: 'import', label: 'Import', number: 1 },
  { key: 'analysis', label: 'Select', number: 2 },
  { key: 'preferences', label: 'Preferences', number: 3 },
  { key: 'results', label: 'Review', number: 4 },
];

const stepOrder: AppStep[] = ['import', 'analysis', 'preferences', 'results'];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();

  if (currentStep === 'overview') {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white border border-border rounded-xl px-4 py-3 mb-6 shadow-xs select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-forest/10 text-forest flex items-center justify-center font-semibold">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold text-charcoal">
                Memory Hub: Session Overview
              </span>
              <span className="text-[10px] bg-forest/10 text-forest px-1.5 py-0.2 rounded font-medium">
                Active Session
              </span>
            </div>
            <p className="text-xs text-muted">
              Inspect chosen preferences, final document review, or navigate to edit steps.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'preferences' })}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-charcoal font-medium transition-colors"
          >
            Preferences
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'SET_STEP', step: 'results' })}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-forest/10 hover:bg-forest/20 text-forest font-semibold transition-colors flex items-center gap-1"
          >
            <span>Review Bullets</span>
            <span>→</span>
          </button>
        </div>
      </div>
    );
  }

  const currentIndex = stepOrder.indexOf(currentStep);

  const isStepAccessible = (stepKey: AppStep, index: number): boolean => {
    if (index <= currentIndex) return true;
    if (stepKey === 'analysis') return state.sections.length > 0;
    if (stepKey === 'preferences') return state.sections.length > 0;
    if (stepKey === 'results') return state.enhancedBullets.length > 0;
    return false;
  };

  const handleStepClick = (stepKey: AppStep, index: number) => {
    if (isStepAccessible(stepKey, index) && stepKey !== currentStep) {
      dispatch({ type: 'SET_STEP', step: stepKey });
    }
  };

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-5 select-none">
      {steps.map((step, i) => {
        const isComplete = i < currentIndex;
        const isCurrent = step.key === currentStep;
        const accessible = isStepAccessible(step.key, i);

        return (
          <div key={step.key} className="flex items-center gap-1 sm:gap-2">
            {/* Step button */}
            <button
              type="button"
              disabled={!accessible}
              onClick={() => handleStepClick(step.key, i)}
              className={`flex items-center gap-1.5 sm:gap-2 transition-all duration-150 ${
                accessible ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
                  transition-colors duration-200
                  ${
                    isComplete
                      ? 'bg-forest text-white'
                      : isCurrent
                        ? 'bg-forest text-white shadow-xs'
                        : 'bg-sage text-muted'
                  }
                `}
              >
                {isComplete ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  step.number
                )}
              </div>
              <span
                className={`
                  text-xs sm:text-sm transition-colors duration-200
                  ${isCurrent ? 'text-charcoal font-semibold' : 'text-muted'}
                `}
              >
                {step.label}
              </span>
            </button>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`
                  w-6 sm:w-10 h-px mx-0.5
                  ${i < currentIndex ? 'bg-forest' : 'bg-border'}
                `}
              />
            )}
          </div>
        );
      })}

      {state.enhancedBullets.length > 0 && (
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_STEP', step: 'overview' })}
          className="ml-3 hidden sm:flex items-center gap-1.5 text-xs text-forest hover:text-forest-dark font-medium bg-sage-light hover:bg-sage/40 px-2.5 py-1 rounded-full border border-forest/20 transition-colors shadow-2xs cursor-pointer"
          title="Return to Session Overview Hub"
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Overview Hub</span>
        </button>
      )}
    </div>
  );
}
