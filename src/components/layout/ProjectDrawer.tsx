import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderOpen,
  Plus,
  GitFork,
  Trash2,
  X,
  Clock,
  Briefcase,
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../ui';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { getProjects, getProject, forkProject, deleteProject, getUploadedResumes } from '../../services/api';
import type { ProjectSummary, UploadedResumeItem } from '../../types';

interface ProjectDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectDrawer({ isOpen, onClose }: ProjectDrawerProps) {
  const { activeProjectId, lastSavedAt, isSavingProject } = useAppState();
  const dispatch = useAppDispatch();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [libraryResumes, setLibraryResumes] = useState<UploadedResumeItem[]>([]);
  const [activeTab, setActiveTab] = useState<'sessions' | 'resumes'>('sessions');
  const [loading, setLoading] = useState(false);
  const [forkingId, setForkingId] = useState<string | null>(null);
  const [newRoleInput, setNewRoleInput] = useState('');

  const loadList = async () => {
    setLoading(true);
    try {
      const [list, resumes] = await Promise.all([getProjects(), getUploadedResumes()]);
      setProjects(list);
      setLibraryResumes(resumes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
    }
  }, [isOpen]);

  const handleSelectProject = async (id: string) => {
    setLoading(true);
    try {
      const detail = await getProject(id);
      if (detail) {
        dispatch({
          type: 'LOAD_PROJECT',
          project: detail,
        });
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFork = async (id: string) => {
    if (!newRoleInput.trim()) return;
    setLoading(true);
    try {
      const forked = await forkProject(id, newRoleInput.trim());
      if (forked) {
        dispatch({
          type: 'LOAD_PROJECT',
          project: forked,
        });
        setForkingId(null);
        setNewRoleInput('');
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this resume project?')) return;
    const ok = await deleteProject(id);
    if (ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProjectId === id) {
        dispatch({ type: 'RESET' });
      }
    }
  };

  if (!isOpen) return null;

  const drawerContent = (
    <div className="fixed inset-0 z-[9999] flex justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-charcoal/50 backdrop-blur-xs" onClick={onClose} />

      {/* Drawer content */}
      <div className="relative w-full max-w-md bg-white h-screen shadow-2xl flex flex-col z-10 border-l border-border">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest">
              <FolderOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-charcoal text-base">Resume Projects & Memory</h3>
              <p className="text-xs text-muted flex items-center gap-1.5">
                {isSavingProject ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-forest" />
                    <span>Saving changes to local DB...</span>
                  </>
                ) : lastSavedAt ? (
                  <>
                    <Save className="w-3 h-3 text-emerald-600" />
                    <span>Auto-saved to local memory</span>
                  </>
                ) : (
                  <span>All resumes saved locally in SQLite</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-charcoal rounded-md hover:bg-neutral-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Saved Sessions vs Base Resumes */}
        <div className="px-4 pt-3 pb-2 border-b border-border bg-neutral-50/70 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'sessions'
                ? 'bg-white text-forest shadow-xs border border-border'
                : 'text-muted hover:text-charcoal hover:bg-neutral-100'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Saved Sessions ({projects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resumes')}
            className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'resumes'
                ? 'bg-white text-forest shadow-xs border border-border'
                : 'text-muted hover:text-charcoal hover:bg-neutral-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Uploaded Resumes ({libraryResumes.length})</span>
          </button>
        </div>

        {/* Drawer Body: Saved Sessions List */}
        {activeTab === 'sessions' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Saved Sessions ({projects.length})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  dispatch({ type: 'RESET' });
                  onClose();
                }}
                className="text-xs h-7 gap-1"
              >
                <Plus className="w-3 h-3" /> New Resume
              </Button>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-forest" />
                <span className="text-xs">Loading projects from local memory...</span>
              </div>
            ) : projects.length === 0 ? (
              <div className="py-12 text-center text-muted border-2 border-dashed border-border rounded-xl p-6">
                <FileText className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                <p className="text-sm font-medium text-charcoal">No saved resumes yet</p>
                <p className="text-xs text-muted mt-1">
                  Upload or paste a resume to automatically save your optimization history.
                </p>
              </div>
            ) : (
              projects.map((p) => {
                const isActive = p.id === activeProjectId;
                const isForking = p.id === forkingId;

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                      isActive
                        ? 'border-forest bg-sage-light/30 shadow-xs ring-1 ring-forest/20'
                        : 'border-border bg-white hover:border-neutral-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-charcoal text-sm">{p.title}</h4>
                          {isActive && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-forest bg-forest/10 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                        {p.target_role && (
                          <p className="text-xs text-forest-dark font-medium flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3 text-muted" /> {p.target_role}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setForkingId(isForking ? null : p.id);
                          }}
                          className="p-1 text-muted hover:text-forest hover:bg-sage-light rounded transition-colors"
                          title="Fork tailored variant for another company/role"
                        >
                          <GitFork className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, p.id)}
                          className="p-1 text-muted hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-muted flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{p.bullet_count} bullets</span>
                        {(p.accepted_count || 0) > 0 && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px] font-medium">
                            {p.accepted_count} accepted
                          </span>
                        )}
                        {(p.rejected_count || 0) > 0 && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded text-[10px] font-medium">
                            {p.rejected_count} rejected
                          </span>
                        )}
                        {(p.pending_count || 0) > 0 && (
                          <span className="bg-neutral-100 text-neutral-600 border border-neutral-200 px-1.5 py-0.2 rounded text-[10px] font-medium">
                            {p.pending_count} pending
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(p.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Fork Inline Input */}
                    {isForking && (
                      <div
                        className="mt-3 pt-3 border-t border-border"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-[11px] font-medium text-charcoal mb-1">
                          Tailor a new copy for another role/company:
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newRoleInput}
                            onChange={(e) => setNewRoleInput(e.target.value)}
                            placeholder="e.g. Senior Tech Lead - Google"
                            className="flex-1 text-xs px-2 py-1 border border-border rounded focus:outline-none focus:border-forest"
                          />
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleFork(p.id)}
                            disabled={!newRoleInput.trim()}
                            className="h-7 text-xs"
                          >
                            Fork
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Drawer Body: Uploaded Base Resumes List */}
        {activeTab === 'resumes' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Base Resumes ({libraryResumes.length})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  dispatch({ type: 'RESET' });
                  onClose();
                }}
                className="text-xs h-7 gap-1"
              >
                <Plus className="w-3 h-3" /> New Upload
              </Button>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-forest" />
                <span className="text-xs">Loading resumes from local memory...</span>
              </div>
            ) : libraryResumes.length === 0 ? (
              <div className="py-12 text-center text-muted border-2 border-dashed border-border rounded-xl p-6">
                <FileText className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
                <p className="text-sm font-medium text-charcoal">No uploaded resumes yet</p>
                <p className="text-xs text-muted mt-1">
                  Upload a resume file to keep a base copy here for instant re-optimization.
                </p>
              </div>
            ) : (
              libraryResumes.map((r) => (
                <div
                  key={r.id}
                  className="p-3.5 rounded-xl border border-border bg-white hover:border-forest/40 hover:shadow-xs transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-forest/10 flex items-center justify-center text-forest shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-charcoal text-sm truncate" title={r.filename}>
                          {r.filename}
                        </h4>
                        <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(r.created_at || (r as any).uploaded_at || Date.now()).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-muted">
                    <div className="flex items-center gap-1.5">
                      <span className="bg-neutral-100 text-charcoal px-1.5 py-0.5 rounded font-medium">
                        {r.bullet_count} bullets
                      </span>
                      <span className="bg-neutral-100 text-charcoal px-1.5 py-0.5 rounded font-medium">
                        {r.section_count} sections
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        dispatch({ type: 'USE_LIBRARY_RESUME', resume: r });
                        onClose();
                      }}
                      className="text-xs h-7 gap-1"
                    >
                      <span>Optimize</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(drawerContent, document.body) : drawerContent;
}
