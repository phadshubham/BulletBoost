import { useState, useEffect } from 'react';
import { Zap, Clock, ArrowLeft } from 'lucide-react';
import { StepIndicator } from '../components/enhance/StepIndicator';
import { ResumeImport } from '../components/enhance/ResumeImport';
import { SectionAnalysis } from '../components/enhance/SectionAnalysis';
import { EnhancementPreferences } from '../components/enhance/EnhancementPreferences';
import { ResultsReview } from '../components/enhance/ResultsReview';
import { Button } from '../components/ui';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { enhanceBulletsWithHeuristics } from '../services/heuristicEnhancer';
import type { SelectedBulletPayload } from '../types';

const PROGRESS_PHASES = [
  'Preparing selected resume bullets and role scope...',
  'Synthesizing impactful action verbs & quantifiable achievements...',
  'Running deterministic evidence validation against facts...',
  'Evaluating quality metrics and formatting final suggestions...',
];

export function EnhancePage() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const { step, isProcessing } = state;

  const [elapsedSec, setElapsedSec] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setElapsedSec(0);
      setPhaseIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    const phaseTimer = setInterval(() => {
      setPhaseIndex((p) => (p + 1) % PROGRESS_PHASES.length);
    }, 2400);

    return () => {
      clearInterval(timer);
      clearInterval(phaseTimer);
    };
  }, [isProcessing]);

  const handleSkipToBuiltin = () => {
    let bulletsPayload: SelectedBulletPayload[] = [];
    for (const section of state.sections) {
      for (const bullet of section.bullets) {
        if (bullet.selected) {
          bulletsPayload.push({
            id: bullet.id,
            text: bullet.text,
            section_title: section.title,
            section_type: section.type,
          });
        }
      }
    }
    if (bulletsPayload.length === 0) {
      for (const section of state.sections) {
        for (const bullet of section.bullets) {
          bulletsPayload.push({
            id: bullet.id,
            text: bullet.text,
            section_title: section.title,
            section_type: section.type,
          });
        }
      }
    }
    if (bulletsPayload.length === 0) {
      bulletsPayload = [
        {
          id: 'demo-b1',
          text: 'Led development of high-throughput payment microservice using Node.js and TypeScript.',
          section_title: 'Experience',
          section_type: 'experience',
        },
        {
          id: 'demo-b2',
          text: 'Architected Redis caching layer reducing database queries by 40% and improving response times.',
          section_title: 'Experience',
          section_type: 'experience',
        },
        {
          id: 'demo-b3',
          text: 'Integrated automated CI/CD pipeline using GitHub Actions and Docker containers on AWS.',
          section_title: 'Experience',
          section_type: 'experience',
        },
      ];
    }

    const effectiveRole = state.preferences.targetRole.trim() || 'Software Professional';
    const enhanced = enhanceBulletsWithHeuristics({
      bullets: bulletsPayload,
      targetRole: effectiveRole,
      jobDescription: state.preferences.jobDescription,
      writingStyle: state.preferences.writingStyle,
    });

    dispatch({ type: 'SET_DEMO_MODE', isDemo: state.isDemo });
    dispatch({ type: 'SET_ENHANCED_BULLETS', bullets: enhanced });
    dispatch({ type: 'SET_PROCESSING', isProcessing: false });
    dispatch({ type: 'SET_STEP', step: 'results' });
  };

  const handleCancel = () => {
    dispatch({ type: 'SET_PROCESSING', isProcessing: false });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <StepIndicator currentStep={step} />

      {/* Processing overlay with active feedback and instant skip button */}
      {isProcessing && (
        <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-in text-center max-w-lg mx-auto">
          {/* Animated badge & spinner */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-3 border-sage border-t-forest animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-6 h-6 text-forest animate-pulse" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-charcoal">
            Enhancing Selected Resume Bullets
          </h3>

          <div className="flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-sage-light text-xs text-forest font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>Elapsed: {elapsedSec}s</span>
          </div>

          <div className="min-h-[2.5rem] flex items-center justify-center my-3">
            <p className="text-xs sm:text-sm text-charcoal/80 font-medium transition-all duration-300">
              {PROGRESS_PHASES[phaseIndex]}
            </p>
          </div>

          <p className="text-xs text-muted max-w-md mx-auto leading-relaxed mb-6">
            Local AI inference and evidence validation are active. Content remains strictly private on your machine.
          </p>

          {/* Interactive controls: User is NEVER trapped! */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <Button
              id="skip-to-builtin-btn"
              onClick={handleSkipToBuiltin}
              size="md"
              className="gap-2 w-full sm:w-auto shadow-sm"
            >
              <Zap className="w-4 h-4" />
              Skip Wait & Proceed Instantly
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs text-muted hover:text-charcoal gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel & Return
            </Button>
          </div>
        </div>
      )}

      {/* Step content */}
      {!isProcessing && (
        <div className="bg-white border border-border rounded-lg p-5 sm:p-7">
          {step === 'import' && <ResumeImport />}
          {step === 'analysis' && <SectionAnalysis />}
          {step === 'preferences' && <EnhancementPreferences />}
          {step === 'results' && <ResultsReview />}
        </div>
      )}
    </div>
  );
}
