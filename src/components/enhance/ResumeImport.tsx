import { useState, useRef, useCallback, type DragEvent } from 'react';
import {
  Upload,
  FileText,
  X,
  ClipboardPaste,
  AlertCircle,
  Shield,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button, Textarea } from '../ui';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { getDemoSections } from '../../data/demo';
import { parseResumeFile, parseResumeText, API_BASE_URL, ApiError } from '../../services/api';
import type { ImportMethod, ParseResumeResponse } from '../../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];
const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResumeImport() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiErrorObj, setApiErrorObj] = useState<ApiError | null>(null);

  const activeTab = state.importMethod;

  const setTab = (method: ImportMethod) => {
    if (isParsing) return;
    dispatch({ type: 'SET_IMPORT_METHOD', method });
    setFileError(null);
    setPasteError(null);
    setApiError(null);
    setApiErrorObj(null);
  };

  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext)) {
      return 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File is too large (${formatFileSize(file.size)}). Maximum size is 10 MB.`;
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (isParsing) return;
      const error = validateFile(file);
      if (error) {
        setFileError(error);
        return;
      }
      setFileError(null);
      setApiError(null);
      setApiErrorObj(null);
      dispatch({
        type: 'SET_IMPORTED_FILE',
        file: { name: file.name, size: file.size, type: file.type },
      });
      dispatch({
        type: 'SET_RAW_FILE',
        file,
      });
    },
    [dispatch, validateFile, isParsing]
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (isParsing) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, isParsing]
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (isParsing) return;
    setIsDragging(true);
  }, [isParsing]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = () => {
    if (isParsing) return;
    dispatch({ type: 'SET_IMPORTED_FILE', file: null });
    dispatch({ type: 'SET_RAW_FILE', file: null });
    setApiError(null);
    setApiErrorObj(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canContinue =
    activeTab === 'upload'
      ? state.importedFile !== null && !isParsing
      : state.pastedText.trim().length >= 50 && !isParsing;

  const handleContinue = async () => {
    if (isParsing) return; // Prevent duplicate submissions while in-progress
    setApiError(null);
    setApiErrorObj(null);

    if (activeTab === 'paste' && state.pastedText.trim().length < 50) {
      setPasteError('Please paste at least 50 characters of resume content.');
      return;
    }

    setIsParsing(true);
    try {
      let result: ParseResumeResponse;
      if (activeTab === 'upload') {
        if (!state.rawFile) {
          setFileError('Please select a resume file to upload.');
          setIsParsing(false);
          return;
        }
        result = await parseResumeFile(state.rawFile);
      } else {
        result = await parseResumeText(state.pastedText, 'pasted_resume.txt');
      }

      // Truthful real data state
      dispatch({
        type: 'SET_BACKEND_HEALTH',
        health: {
          status: 'connected',
          apiUrl: API_BASE_URL,
          lastChecked: Date.now(),
        },
      });
      dispatch({ type: 'SET_DEMO_MODE', isDemo: false });
      dispatch({ type: 'SET_SECTIONS', sections: result.sections });
      dispatch({ type: 'SET_PARSING_WARNINGS', warnings: result.warnings || [] });
      dispatch({ type: 'SET_STEP', step: 'analysis' });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setApiErrorObj(err);
        setApiError(err.message);
        if (err.isNetworkError) {
          dispatch({
            type: 'SET_BACKEND_HEALTH',
            health: {
              status: 'disconnected',
              apiUrl: API_BASE_URL,
              error: err.message,
              isNetworkError: true,
              lastChecked: Date.now(),
            },
          });
        }
      } else {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred while parsing.';
        setApiError(message);
        setApiErrorObj(new ApiError(message, 500, false));
      }
    } finally {
      setIsParsing(false);
    }
  };

  const handleLoadSampleResume = () => {
    if (isParsing) return;
    setApiError(null);
    setApiErrorObj(null);
    dispatch({ type: 'SET_DEMO_MODE', isDemo: true });
    dispatch({ type: 'SET_SECTIONS', sections: getDemoSections() });
    dispatch({ type: 'SET_PARSING_WARNINGS', warnings: [] });
    dispatch({
      type: 'SET_IMPORTED_FILE',
      file: {
        name: 'sample_fullstack_engineer.txt',
        size: 3420,
        type: 'text/plain',
      },
    });
    dispatch({ type: 'SET_STEP', step: 'analysis' });
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-charcoal">Import Your Resume</h2>
        <p className="text-sm text-muted mt-1.5">
          Upload a file or paste your resume text to begin enhancement.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2
            transition-colors duration-150 focus-ring -mb-px cursor-pointer
            ${
              activeTab === 'upload'
                ? 'border-forest text-forest'
                : 'border-transparent text-muted hover:text-charcoal'
            }
          `}
          onClick={() => setTab('upload')}
          disabled={isParsing}
        >
          <Upload className="w-4 h-4" />
          Upload Resume
        </button>
        <button
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2
            transition-colors duration-150 focus-ring -mb-px cursor-pointer
            ${
              activeTab === 'paste'
                ? 'border-forest text-forest'
                : 'border-transparent text-muted hover:text-charcoal'
            }
          `}
          onClick={() => setTab('paste')}
          disabled={isParsing}
        >
          <ClipboardPaste className="w-4 h-4" />
          Paste Resume Text
        </button>
      </div>

      {/* Upload panel */}
      {activeTab === 'upload' && (
        <div className="animate-fade-in">
          {!state.importedFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-10 text-center cursor-pointer
                transition-all duration-200
                ${
                  isDragging
                    ? 'border-forest bg-sage-light'
                    : 'border-border hover:border-forest-light hover:bg-sage-light/50'
                }
                ${isParsing ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}
              `}
              onClick={() => {
                if (!isParsing) fileInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (!isParsing && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload resume file"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                disabled={isParsing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-sage flex items-center justify-center">
                  <Upload className={`w-5 h-5 ${isDragging ? 'text-forest' : 'text-muted'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {isDragging ? 'Drop your file here' : 'Drag and drop your resume'}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    or click to browse · PDF, DOCX, TXT · Max 10 MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-border rounded-lg p-4 flex items-center justify-between animate-fade-in bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-sage flex items-center justify-center">
                  <FileText className="w-5 h-5 text-forest" />
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal">
                    {state.importedFile.name}
                  </p>
                  <p className="text-xs text-muted">
                    {formatFileSize(state.importedFile.size)}
                  </p>
                </div>
              </div>
              <button
                className="p-1.5 text-muted hover:text-error transition-colors rounded focus-ring cursor-pointer"
                onClick={removeFile}
                aria-label="Remove file"
                disabled={isParsing}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {fileError && (
            <div className="flex items-center gap-2 mt-3 text-sm text-error">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {fileError}
            </div>
          )}
        </div>
      )}

      {/* Paste panel */}
      {activeTab === 'paste' && (
        <div className="animate-fade-in">
          <Textarea
            label="Resume content"
            placeholder="Paste your full resume text here. Include all sections — summary, experience, education, skills, etc."
            rows={14}
            value={state.pastedText}
            onChange={(e) => {
              dispatch({ type: 'SET_PASTED_TEXT', text: e.target.value });
              setPasteError(null);
            }}
            error={pasteError ?? undefined}
            disabled={isParsing}
            helperText={
              state.pastedText.length > 0
                ? `${state.pastedText.length} characters`
                : 'Minimum 50 characters required'
            }
          />
        </div>
      )}

      {/* API Error Message with Diagnostics */}
      {apiError && (
        <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-red-900">
                  {apiErrorObj?.isNetworkError
                    ? 'Backend Connection Failed'
                    : `Parsing Failed (HTTP ${apiErrorObj?.status || 400})`}
                </p>
                {apiErrorObj?.isNetworkError && (
                  <span className="text-[11px] font-mono bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-medium">
                    {API_BASE_URL}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-red-700 leading-relaxed">{apiError}</p>

              {apiErrorObj?.isNetworkError && (
                <div className="mt-2.5 p-2.5 rounded bg-white/80 border border-red-200 text-xs text-red-900 space-y-1.5">
                  <p className="font-sans text-[11px] text-red-700 font-medium">
                    To start the BulletBoost FastAPI backend, run in PowerShell:
                  </p>
                  <pre className="bg-neutral-900 text-neutral-100 p-2 rounded text-[11px] font-mono select-all overflow-x-auto">
                    .\start_local.ps1
                  </pre>
                  <p className="font-sans text-[11px] text-red-600">
                    Or start manually with:{' '}
                    <code className="font-mono bg-red-50 text-red-800 px-1 py-0.5 rounded text-[11px]">
                      python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
                    </code>
                  </p>
                </div>
              )}

              <div className="mt-3.5 flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleContinue}
                  disabled={isParsing}
                  className="border-red-300 text-red-800 hover:bg-red-100 disabled:opacity-60 cursor-pointer"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Retrying Connection…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Retry Connection
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={handleLoadSampleResume}
                  disabled={isParsing}
                  className="text-xs text-red-700 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  Or explore with sample resume (demo mode)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy note */}
      <div className="flex items-start gap-2 mt-5 p-3 rounded-md bg-sage-light text-xs text-muted">
        <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-forest" />
        <span>
          Resumes are processed in-memory by the local FastAPI backend (
          <code className="text-charcoal bg-white/70 px-1 py-0.5 rounded font-mono text-[11px]">
            {API_BASE_URL}
          </code>
          ). Content is parsed without permanent disk storage.
        </span>
      </div>

      {/* Sample Resume / Demo Option */}
      <div className="mt-4 p-3.5 rounded-lg border border-dashed border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-sage/60 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-forest" />
          </div>
          <div>
            <p className="text-xs font-semibold text-charcoal">Looking for a quick preview?</p>
            <p className="text-xs text-muted">
              Load our pre-configured software engineer resume in demo mode.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleLoadSampleResume}
          disabled={isParsing}
        >
          Load Demo Resume
        </Button>
      </div>

      {/* Continue */}
      <div className="flex justify-end mt-6">
        <Button
          onClick={handleContinue}
          disabled={!canContinue || isParsing}
          size="lg"
          className="min-w-[190px]"
        >
          {isParsing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing Resume…
            </span>
          ) : (
            'Continue to Analysis'
          )}
        </Button>
      </div>
    </div>
  );
}
