import { Check } from 'lucide-react';
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
    </div>
  );
}
