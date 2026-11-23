import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
  type Dispatch,
} from 'react';
import type {
  AppState,
  AppStep,
  ImportMethod,
  ImportedFile,
  ResumeSection,
  EnhancementPreferences,
  EnhancedBullet,
  ReviewStatus,
  BulletQuality,
  BackendHealthState,
} from '../types';
import { API_BASE_URL, checkBackendHealth, createProject, updateProject, scoreResumeAts } from '../services/api';

// ── Initial state ───────────────────────────────────────────────────

const initialState: AppState = {
  step: 'import',
  importMethod: 'upload',
  importedFile: null,
  rawFile: null,
  pastedText: '',
  isDemo: false,
  sections: [],
  parsingWarnings: [],
  preferences: {
    targetRole: '',
    jobDescription: '',
    writingStyle: 'achievement',
    scope: 'bullets',
  },
  enhancedBullets: [],
  isProcessing: false,
  error: null,
  backendHealth: {
    status: 'checking',
    apiUrl: API_BASE_URL,
  },
};

// ── Actions ─────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_STEP'; step: AppStep }
  | { type: 'SET_IMPORT_METHOD'; method: ImportMethod }
  | { type: 'SET_IMPORTED_FILE'; file: ImportedFile | null }
  | { type: 'SET_RAW_FILE'; file: File | null }
  | { type: 'SET_PASTED_TEXT'; text: string }
  | { type: 'SET_DEMO_MODE'; isDemo: boolean }
  | { type: 'SET_SECTIONS'; sections: ResumeSection[] }
  | { type: 'SET_PARSING_WARNINGS'; warnings: string[] }
  | { type: 'TOGGLE_SECTION_SELECTED'; sectionId: string }
  | { type: 'TOGGLE_SECTION_EXPANDED'; sectionId: string }
  | { type: 'TOGGLE_BULLET_SELECTED'; sectionId: string; bulletId: string }
  | { type: 'SELECT_ALL_SECTIONS'; selected: boolean }
  | { type: 'SET_PREFERENCES'; preferences: Partial<EnhancementPreferences> }
  | { type: 'SET_ENHANCED_BULLETS'; bullets: EnhancedBullet[] }
  | { type: 'SET_BULLET_STATUS'; bulletId: string; status: ReviewStatus }
  | { type: 'SET_BULLET_EDITED_TEXT'; bulletId: string; text: string }
  | {
      type: 'SET_BULLET_CLASSIFICATION';
      bulletId: string;
      expectedOriginalText?: string;
      expectedImprovedText?: string | null;
      originalQuality?: BulletQuality | null;
      originalConfidence?: number | null;
      improvedQuality?: BulletQuality | null;
      improvedConfidence?: number | null;
      classifierUnavailable?: boolean;
    }
  | {
      type: 'SET_BATCH_BULLET_CLASSIFICATIONS';
      classifications: Array<{
        bulletId: string;
        expectedOriginalText?: string;
        expectedImprovedText?: string | null;
        originalQuality?: BulletQuality | null;
        originalConfidence?: number | null;
        improvedQuality?: BulletQuality | null;
        improvedConfidence?: number | null;
        classifierUnavailable?: boolean;
      }>;
    }
  | { type: 'UPDATE_ENHANCED_BULLET'; bullet: EnhancedBullet }
  | { type: 'SET_PROCESSING'; isProcessing: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_BACKEND_HEALTH'; health: BackendHealthState }
  | { type: 'LOAD_PROJECT'; project: import('../types').ProjectDetail }
  | { type: 'SET_ATS_SCORE'; score: import('../types').AtsResumeScore | null }
  | { type: 'SET_ACTIVE_PROJECT_ID'; projectId: string | null }
  | { type: 'SET_SAVING_STATUS'; isSaving: boolean; lastSavedAt?: string }
  | { type: 'SET_BULLET_ATS_DELTA'; bulletId: string; delta: number; breakdown: string[] }
  | { type: 'SET_BULLET_STYLE_VARIATION'; bulletId: string; variation: 'xyz' | 'executive' | 'technical' }
  | { type: 'USE_LIBRARY_RESUME'; resume: import('../types').UploadedResumeItem }
  | { type: 'RESET' };

// ── Reducer ─────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_BACKEND_HEALTH':
      return { ...state, backendHealth: action.health };

    case 'SET_STEP':
      return { ...state, step: action.step, error: null };

    case 'SET_IMPORT_METHOD':
      return { ...state, importMethod: action.method };

    case 'SET_IMPORTED_FILE':
      return { ...state, importedFile: action.file, error: null };

    case 'SET_RAW_FILE':
      return { ...state, rawFile: action.file };

    case 'SET_PASTED_TEXT':
      return { ...state, pastedText: action.text, error: null };

    case 'SET_DEMO_MODE':
      return { ...state, isDemo: action.isDemo };

    case 'SET_SECTIONS':
      return { ...state, sections: action.sections };

    case 'SET_PARSING_WARNINGS':
      return { ...state, parsingWarnings: action.warnings };

    case 'TOGGLE_SECTION_SELECTED': {
      const sections = state.sections.map((s) => {
        if (s.id !== action.sectionId) return s;
        const newSelected = !s.selected;
        return {
          ...s,
          selected: newSelected,
          bullets: s.bullets.map((b) => ({ ...b, selected: newSelected })),
        };
      });
      return { ...state, sections };
    }

    case 'TOGGLE_SECTION_EXPANDED': {
      const sections = state.sections.map((s) =>
        s.id === action.sectionId ? { ...s, expanded: !s.expanded } : s
      );
      return { ...state, sections };
    }

    case 'TOGGLE_BULLET_SELECTED': {
      const sections = state.sections.map((s) => {
        if (s.id !== action.sectionId) return s;
        const bullets = s.bullets.map((b) =>
          b.id === action.bulletId ? { ...b, selected: !b.selected } : b
        );
        const allSelected = bullets.every((b) => b.selected);
        const anySelected = bullets.some((b) => b.selected);
        return {
          ...s,
          bullets,
          selected: allSelected ? true : anySelected ? true : false,
        };
      });
      return { ...state, sections };
    }

    case 'SELECT_ALL_SECTIONS': {
      const sections = state.sections.map((s) => ({
        ...s,
        selected: action.selected,
        bullets: s.bullets.map((b) => ({
          ...b,
          selected: action.selected,
        })),
      }));
      return { ...state, sections };
    }

    case 'SET_PREFERENCES':
      return {
        ...state,
        preferences: { ...state.preferences, ...action.preferences },
      };

    case 'SET_ENHANCED_BULLETS':
      return { ...state, enhancedBullets: action.bullets };

    case 'SET_BULLET_STATUS': {
      const enhancedBullets = state.enhancedBullets.map((b) =>
        b.id === action.bulletId ? { ...b, status: action.status } : b
      );
      return { ...state, enhancedBullets };
    }

    case 'SET_BULLET_EDITED_TEXT': {
      const enhancedBullets = state.enhancedBullets.map((b) =>
        b.id === action.bulletId
          ? {
              ...b,
              editedImproved: action.text,
              improvedQuality: undefined,
              improvedConfidence: undefined,
            }
          : b
      );
      return { ...state, enhancedBullets };
    }

    case 'SET_BULLET_CLASSIFICATION': {
      const enhancedBullets = state.enhancedBullets.map((b) => {
        if (b.id !== action.bulletId) return b;
        const origMatches =
          action.expectedOriginalText === undefined || action.expectedOriginalText === b.original;
        const currentImproved = b.editedImproved ?? b.improved;
        const impMatches =
          action.expectedImprovedText === undefined || action.expectedImprovedText === currentImproved;

        return {
          ...b,
          originalQuality:
            origMatches && action.originalQuality !== undefined
              ? action.originalQuality
              : b.originalQuality,
          originalConfidence:
            origMatches && action.originalConfidence !== undefined
              ? action.originalConfidence
              : b.originalConfidence,
          improvedQuality:
            impMatches && action.improvedQuality !== undefined
              ? action.improvedQuality
              : b.improvedQuality,
          improvedConfidence:
            impMatches && action.improvedConfidence !== undefined
              ? action.improvedConfidence
              : b.improvedConfidence,
          classifierUnavailable:
            action.classifierUnavailable !== undefined
              ? action.classifierUnavailable
              : b.classifierUnavailable,
        };
      });
      return { ...state, enhancedBullets };
    }

    case 'SET_BATCH_BULLET_CLASSIFICATIONS': {
      const map = new Map(action.classifications.map((c) => [c.bulletId, c]));
      const enhancedBullets = state.enhancedBullets.map((b) => {
        const item = map.get(b.id);
        if (!item) return b;

        const origMatches =
          item.expectedOriginalText === undefined || item.expectedOriginalText === b.original;
        const currentImproved = b.editedImproved ?? b.improved;
        const impMatches =
          item.expectedImprovedText === undefined || item.expectedImprovedText === currentImproved;

        return {
          ...b,
          originalQuality:
            origMatches && item.originalQuality !== undefined
              ? item.originalQuality
              : b.originalQuality,
          originalConfidence:
            origMatches && item.originalConfidence !== undefined
              ? item.originalConfidence
              : b.originalConfidence,
          improvedQuality:
            impMatches && item.improvedQuality !== undefined
              ? item.improvedQuality
              : b.improvedQuality,
          improvedConfidence:
            impMatches && item.improvedConfidence !== undefined
              ? item.improvedConfidence
              : b.improvedConfidence,
          classifierUnavailable:
            item.classifierUnavailable !== undefined
              ? item.classifierUnavailable
              : b.classifierUnavailable,
        };
      });
      return { ...state, enhancedBullets };
    }

    case 'UPDATE_ENHANCED_BULLET': {
      const enhancedBullets = state.enhancedBullets.map((b) =>
        b.id === action.bullet.id ? action.bullet : b
      );
      return { ...state, enhancedBullets };
    }

    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.isProcessing };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_ATS_SCORE':
      return { ...state, atsScore: action.score };

    case 'SET_ACTIVE_PROJECT_ID':
      return { ...state, activeProjectId: action.projectId };

    case 'SET_SAVING_STATUS':
      return {
        ...state,
        isSavingProject: action.isSaving,
        lastSavedAt: action.lastSavedAt ?? state.lastSavedAt,
      };

    case 'SET_BULLET_ATS_DELTA': {
      const enhancedBullets = state.enhancedBullets.map((b) => {
        if (b.id !== action.bulletId) return b;
        return {
          ...b,
          atsDelta: action.delta,
          atsBreakdown: action.breakdown,
        };
      });
      return { ...state, enhancedBullets };
    }

    case 'SET_BULLET_STYLE_VARIATION': {
      const enhancedBullets = state.enhancedBullets.map((b) => {
        if (b.id !== action.bulletId) return b;
        return {
          ...b,
          styleVariation: action.variation,
        };
      });
      return { ...state, enhancedBullets };
    }

    case 'LOAD_PROJECT': {
      const proj = action.project;
      const enhancedBullets = proj.enhanced_bullets || [];
      return {
        ...state,
        activeProjectId: proj.id,
        sections: proj.sections || [],
        enhancedBullets: enhancedBullets,
        pastedText: proj.raw_text || state.pastedText,
        importedFile: proj.filename ? { name: proj.filename, size: 0, type: 'text/plain' } : state.importedFile,
        preferences: {
          targetRole: proj.target_role || '',
          jobDescription: proj.job_description || '',
          writingStyle: (proj.writing_style as any) || 'achievement',
          scope: 'bullets',
        },
        step: 'overview',
        error: null,
      };
    }

    case 'USE_LIBRARY_RESUME': {
      const r = action.resume;
      const sections = (r.sections || []).map((s) => ({
        ...s,
        selected: true,
        bullets: s.bullets.map((b) => ({ ...b, selected: true })),
      }));
      return {
        ...state,
        activeProjectId: null,
        sections,
        enhancedBullets: [],
        pastedText: r.raw_text || '',
        importedFile: { name: r.filename, size: 0, type: 'text/plain' },
        preferences: {
          targetRole: '',
          jobDescription: '',
          writingStyle: 'achievement',
          scope: 'bullets',
        },
        step: 'preferences',
        error: null,
      };
    }

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────────────────

const AppStateContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<Dispatch<Action>>(() => {});

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Lightweight single check on application startup
  useEffect(() => {
    let active = true;
    checkBackendHealth().then((res) => {
      if (!active) return;
      if (res.ok) {
        dispatch({
          type: 'SET_BACKEND_HEALTH',
          health: {
            status: 'connected',
            apiUrl: API_BASE_URL,
            version: res.version,
            lastChecked: Date.now(),
          },
        });
      } else {
        dispatch({
          type: 'SET_BACKEND_HEALTH',
          health: {
            status: 'disconnected',
            apiUrl: API_BASE_URL,
            error: res.error,
            isNetworkError: res.isNetworkError,
            lastChecked: Date.now(),
          },
        });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Debounced Auto-Save to Local SQLite DB when sections, preferences, or enhanced bullets change
  useEffect(() => {
    if (!state.sections || state.sections.length === 0 || state.backendHealth.status !== 'connected') {
      return;
    }

    const timer = setTimeout(async () => {
      dispatch({ type: 'SET_SAVING_STATUS', isSaving: true });
      try {
        if (state.activeProjectId) {
          await updateProject(state.activeProjectId, {
            title: state.preferences.targetRole ? `Resume - ${state.preferences.targetRole}` : (state.importedFile?.name || 'My Resume'),
            target_role: state.preferences.targetRole,
            job_description: state.preferences.jobDescription,
            writing_style: state.preferences.writingStyle,
            sections: state.sections,
            enhanced_bullets: state.enhancedBullets,
          });
        } else {
          const created = await createProject({
            title: state.preferences.targetRole ? `Resume - ${state.preferences.targetRole}` : (state.importedFile?.name || 'My Resume'),
            target_role: state.preferences.targetRole,
            job_description: state.preferences.jobDescription,
            writing_style: state.preferences.writingStyle,
            sections: state.sections,
            enhanced_bullets: state.enhancedBullets,
            filename: state.importedFile?.name || 'resume.txt',
            raw_text: state.pastedText,
          });
          if (created) {
            dispatch({ type: 'SET_ACTIVE_PROJECT_ID', projectId: created.id });
          }
        }
        dispatch({ type: 'SET_SAVING_STATUS', isSaving: false, lastSavedAt: new Date().toLocaleTimeString() });
      } catch {
        dispatch({ type: 'SET_SAVING_STATUS', isSaving: false });
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [state.sections, state.preferences, state.enhancedBullets, state.activeProjectId, state.backendHealth.status]);

  // Recalculate ATS Score when sections, JD, target role, or accepted bullets update
  useEffect(() => {
    if (!state.sections || state.sections.length === 0 || state.backendHealth.status !== 'connected') {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const acceptedMap: Record<string, string> = {};
        for (const b of state.enhancedBullets) {
          if (b.status === 'accepted') {
            const improvedText = (b.editedImproved ?? b.improved ?? b.original).trim();
            const key1 = b.originalBulletId || (b as any).original_bullet_id || b.id;
            if (key1) acceptedMap[key1] = improvedText;
            if (b.original && b.original.trim()) {
              acceptedMap[b.original.trim()] = improvedText;
            }
          }
        }

        const score = await scoreResumeAts(
          state.sections,
          state.preferences.jobDescription,
          state.preferences.targetRole,
          Object.keys(acceptedMap).length > 0 ? acceptedMap : undefined
        );
        if (score) {
          dispatch({ type: 'SET_ATS_SCORE', score });
        }
      } catch {
        // fail gracefully
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [state.sections, state.preferences.jobDescription, state.preferences.targetRole, state.enhancedBullets, state.backendHealth.status]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export async function refreshBackendHealth(dispatch: Dispatch<Action>): Promise<void> {
  dispatch({
    type: 'SET_BACKEND_HEALTH',
    health: {
      status: 'checking',
      apiUrl: API_BASE_URL,
    },
  });
  const res = await checkBackendHealth();
  if (res.ok) {
    dispatch({
      type: 'SET_BACKEND_HEALTH',
      health: {
        status: 'connected',
        apiUrl: API_BASE_URL,
        version: res.version,
        lastChecked: Date.now(),
      },
    });
  } else {
    dispatch({
      type: 'SET_BACKEND_HEALTH',
      health: {
        status: 'disconnected',
        apiUrl: API_BASE_URL,
        error: res.error,
        isNetworkError: res.isNetworkError,
        lastChecked: Date.now(),
      },
    });
  }
}

export function useAppState(): AppState {
  return useContext(AppStateContext);
}

export function useAppDispatch(): Dispatch<Action> {
  return useContext(AppDispatchContext);
}

