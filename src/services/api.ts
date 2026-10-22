import type { ParseResumeResponse } from '../types';

/**
 * Returns the configured backend API base URL.
 * Defaults to http://localhost:8000 for local development.
 * Automatically trims trailing slashes to ensure reliable endpoint construction.
 */
export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://127.0.0.1:8000';
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Constructs a normalized, reliable full API endpoint URL.
 * Handles leading and trailing slashes correctly to avoid malformed URLs.
 */
export function buildApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  return `${base}/${cleanEndpoint}`;
}

/**
 * Typed API Error distinguishing network connection failures from HTTP server errors.
 */
export class ApiError extends Error {
  status: number;
  isNetworkError: boolean;
  endpoint?: string;
  baseUrl: string;

  constructor(
    message: string,
    status: number = 500,
    isNetworkError: boolean = false,
    endpoint?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.isNetworkError = isNetworkError;
    this.endpoint = endpoint;
    this.baseUrl = getApiBaseUrl();
  }
}

/**
 * Check if the backend is reachable via /api/health
 * Validates actual response schema and handles timeout and connection errors.
 */
export async function checkBackendHealth(): Promise<{
  ok: boolean;
  app?: string;
  version?: string;
  error?: string;
  isNetworkError?: boolean;
}> {
  const url = buildApiUrl('/api/health');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        ok: false,
        error: `Backend responded with HTTP ${res.status} (${res.statusText || 'Error'})`,
        isNetworkError: false,
      };
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      return {
        ok: false,
        error: 'Backend returned an invalid non-JSON health response.',
        isNetworkError: false,
      };
    }

    if (!data || typeof data !== 'object' || data.status !== 'ok' || !data.app) {
      return {
        ok: false,
        error: 'Backend health check returned an invalid schema.',
        isNetworkError: false,
      };
    }

    return { ok: true, app: data.app, version: data.version };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        ok: false,
        error: `Connection to ${getApiBaseUrl()}/api/health timed out after 6 seconds.`,
        isNetworkError: true,
      };
    }
    const msg = err instanceof Error ? err.message : 'Connection failed';
    return {
      ok: false,
      error: `Cannot reach backend at ${getApiBaseUrl()}. Please ensure the FastAPI server is running. (${msg})`,
      isNetworkError: true,
    };
  }
}

/**
 * Upload a resume file (PDF, DOCX, TXT) to the backend parser
 */
export async function parseResumeFile(file: File): Promise<ParseResumeResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const url = buildApiUrl('/api/parse-resume');

  try {
    const res = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status} error`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          errorDetail = errorJson.detail;
        }
      } catch {
        errorDetail = res.statusText || errorDetail;
      }
      throw new ApiError(errorDetail, res.status, false, '/api/parse-resume');
    }

    const data: ParseResumeResponse = await res.json();
    return data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        `Cannot connect to BulletBoost backend at ${getApiBaseUrl()}. Please ensure the Python FastAPI server is running.`,
        0,
        true,
        '/api/parse-resume'
      );
    }
    throw new ApiError(
      (err as Error).message || 'Failed to parse resume file.',
      500,
      false,
      '/api/parse-resume'
    );
  }
}

/**
 * Send raw pasted resume text to the backend parser
 */
export async function parseResumeText(
  text: string,
  filename: string = 'pasted_resume.txt'
): Promise<ParseResumeResponse> {
  const url = buildApiUrl('/api/parse-resume-text');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ text, filename }),
    });

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status} error`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          errorDetail = errorJson.detail;
        }
      } catch {
        errorDetail = res.statusText || errorDetail;
      }
      throw new ApiError(errorDetail, res.status, false, '/api/parse-resume-text');
    }

    const data: ParseResumeResponse = await res.json();
    return data;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        `Cannot connect to BulletBoost backend at ${getApiBaseUrl()}. Please ensure the Python FastAPI server is running.`,
        0,
        true,
        '/api/parse-resume-text'
      );
    }
    throw new ApiError(
      (err as Error).message || 'Failed to parse resume text.',
      500,
      false,
      '/api/parse-resume-text'
    );
  }
}

/**
 * Check Ollama local LLM status via backend
 */
export async function getOllamaStatus(): Promise<import('../types').OllamaStatus> {
  const url = buildApiUrl('/api/ollama/status');
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        reachable: false,
        configured_model: 'llama3.2:3b',
        model_installed: false,
        status_message: `Backend returned HTTP ${res.status} when checking Ollama status.`,
        error_category: 'backend_error',
        available_models: [],
      };
    }
    return await res.json();
  } catch {
    return {
      reachable: false,
      configured_model: 'llama3.2:3b',
      model_installed: false,
      status_message: `Cannot reach backend at ${getApiBaseUrl()} to check Ollama status.`,
      error_category: 'backend_unreachable',
      available_models: [],
    };
  }
}

/**
 * Request real LLM bullet enhancement from the backend
 */
export async function enhanceBullets(
  payload: import('../types').EnhanceBulletsRequest,
  timeoutMs: number = 120000,
  externalSignal?: AbortSignal
): Promise<import('../types').EnhanceBulletsResponse> {
  const url = buildApiUrl('/api/enhance-bullets');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status} error`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          errorDetail = errorJson.detail;
        }
      } catch {
        errorDetail = res.statusText || errorDetail;
      }
      throw new ApiError(errorDetail, res.status, false, '/api/enhance-bullets');
    }

    return await res.json();
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(
        `Enhancement request timed out after ${timeoutMs / 1000}s. Ollama or backend may be busy.`,
        504,
        true,
        '/api/enhance-bullets'
      );
    }
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        `Cannot connect to BulletBoost backend at ${getApiBaseUrl()}. Ensure uvicorn is running.`,
        0,
        true,
        '/api/enhance-bullets'
      );
    }
    throw new ApiError(
      (err as Error).message || 'Enhancement request failed.',
      500,
      false,
      '/api/enhance-bullets'
    );
  }
}

/**
 * Submit bullet points to the custom scikit-learn classifier
 */
export async function classifyBullets(
  bullets: import('../types').BulletClassifyInput[]
): Promise<import('../types').ClassifyBulletsResponse> {
  const url = buildApiUrl('/api/classify-bullets');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ bullets }),
    });

    if (!res.ok) {
      let errorDetail = `HTTP ${res.status} error`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) errorDetail = errorJson.detail;
      } catch {
        errorDetail = res.statusText || errorDetail;
      }
      throw new ApiError(errorDetail, res.status, false, '/api/classify-bullets');
    }

    return await res.json();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        `Cannot connect to BulletBoost backend at ${getApiBaseUrl()}. Ensure uvicorn is running.`,
        0,
        true,
        '/api/classify-bullets'
      );
    }
    throw new ApiError(
      (err as Error).message || 'Classification request failed.',
      500,
      false,
      '/api/classify-bullets'
    );
  }
}

/**
 * Fetch real evaluation metrics from the held-out test split
 */
export async function getEvaluationMetrics(): Promise<import('../types').EvaluationMetricsResponse> {
  const url = buildApiUrl('/api/evaluation/metrics');
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        available: false,
        status_message: `Backend returned HTTP ${res.status} when retrieving evaluation metrics.`,
      };
    }
    return await res.json();
  } catch {
    return {
      available: false,
      status_message: `Cannot reach backend at ${getApiBaseUrl()} to load evaluation metrics.`,
    };
  }
}

/**
 * Fetch ML classifier runtime status
 */
export async function getClassifierStatus(): Promise<import('../types').ClassifierStatus> {
  const url = buildApiUrl('/api/classifier/status');
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        model_loaded: false,
        model_path: '',
        dataset_available: false,
        dataset_path: '',
        evaluation_report_available: false,
      };
    }
    return await res.json();
  } catch {
    return {
      model_loaded: false,
      model_path: '',
      dataset_available: false,
      dataset_path: '',
      evaluation_report_available: false,
    };
  }
}

/**
 * Export the enhanced resume as a real formatted DOCX file.
 * Replaces only user-accepted bullets and preserves original section structure.
 */
export async function exportResumeDocx(
  request: import('../types').ExportDocxRequest
): Promise<Blob> {
  const url = buildApiUrl('/api/export-docx');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      let errMessage = `Export failed with HTTP ${res.status}`;
      try {
        const errData = await res.json();
        if (errData?.detail) errMessage = errData.detail;
      } catch {
        // ignore
      }
      throw new ApiError(errMessage, res.status, false, '/api/export-docx');
    }

    return await res.blob();
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) {
      throw new ApiError(
        `Cannot connect to BulletBoost backend at ${getApiBaseUrl()}. Please ensure the server is running.`,
        0,
        true,
        '/api/export-docx'
      );
    }
    throw new ApiError(
      (err as Error).message || 'Export failed.',
      500,
      false,
      '/api/export-docx'
    );
  }
}
