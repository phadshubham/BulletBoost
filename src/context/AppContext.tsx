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
import { API_BASE_URL, checkBackendHealth } from '../services/api';

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

