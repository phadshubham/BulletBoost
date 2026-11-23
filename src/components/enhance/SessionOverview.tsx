import { useState } from 'react';
import {
  FileText,
  FileDown,
  Mail,
  RefreshCw,
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  Sparkles,
  Send,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { Button, Badge, StatusIndicator } from '../ui';
import { useAppState, useAppDispatch } from '../../context/AppContext';
import { exportResumeDocx, sendResumeEmail } from '../../services/api';
import { AtsScoreGauge } from './AtsScoreGauge';

interface SessionOverviewProps {
  onOpenDrawer?: () => void;
}

export function SessionOverview({ onOpenDrawer }: SessionOverviewProps) {
  const state = useAppState();
  const dispatch = useAppDispatch();

  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Resend Email states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailSubject, setEmailSubject] = useState(
    state.preferences.targetRole
      ? `Optimized Resume — ${state.preferences.targetRole}`
      : 'Optimized Resume Application'
  );
  const [emailMessage, setEmailMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const acceptedBullets = state.enhancedBullets.filter((b) => b.status === 'accepted');
  const rejectedBullets = state.enhancedBullets.filter((b) => b.status === 'rejected');
  const pendingBullets = state.enhancedBullets.filter((b) => b.status === 'pending' || b.status === 'review_needed');
  const totalBullets = state.sections.reduce((sum, s) => sum + s.bullets.length, 0);

  // Map of accepted improvements by originalBulletId
  const acceptedMap = new Map<string, string>();
  for (const b of acceptedBullets) {
    acceptedMap.set(b.originalBulletId, (b.editedImproved ?? b.improved ?? b.original).trim());
  }

  const handleDownloadDocx = async () => {
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);
    try {
      const acceptedBulletsPayload = acceptedBullets.map((b) => ({
        bullet_id: b.originalBulletId,
        text: (b.editedImproved ?? b.improved ?? b.original).trim(),
      }));

      let baseName = 'BulletBoost_Enhanced_Resume.docx';
      if (state.importedFile?.name) {
        const nameWithoutExt = state.importedFile.name.replace(/\.[^/.]+$/, '');
        baseName = `${nameWithoutExt}_enhanced.docx`;
      }

      const blob = await exportResumeDocx({
        filename: baseName,
        sections: state.sections,
        accepted_bullets: acceptedBulletsPayload,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = baseName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccess(`Successfully downloaded "${baseName}"!`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: unknown) {
      setExportError((err as Error).message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailRecipient.trim() || !emailRecipient.includes('@')) {
      setEmailStatus({
        type: 'error',
        message: 'Please provide a valid recipient email address (e.g. recruiter@company.com).',
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const acceptedBulletsPayload = acceptedBullets.map((b) => ({
        bullet_id: b.originalBulletId,
        text: (b.editedImproved ?? b.improved ?? b.original).trim(),
      }));

      let baseName = 'BulletBoost_Enhanced_Resume.docx';
      if (state.importedFile?.name) {
        const nameWithoutExt = state.importedFile.name.replace(/\.[^/.]+$/, '');
        baseName = `${nameWithoutExt}_enhanced.docx`;
      }

      const res = await sendResumeEmail({
        recipient_email: emailRecipient.trim(),
        sections: state.sections,
        accepted_bullets: acceptedBulletsPayload,
        filename: baseName,
        subject: emailSubject,
        message: emailMessage,
        target_role: state.preferences.targetRole,
      });

      if (res.status === 'success') {
        setEmailStatus({
          type: 'success',
          message: `Resume successfully delivered to ${res.recipient} via Resend! (ID: ${res.email_id || 'sent'})`,
        });
      } else if (res.status === 'api_key_missing') {
        setEmailStatus({
          type: 'warning',
          message: 'Resend API key is not configured. Add RESEND_API_KEY to your backend .env file to enable live email delivery via Resend (https://resend.com).',
        });
      } else {
        setEmailStatus({ type: 'error', message: res.message });
      }
    } catch (err: unknown) {
      setEmailStatus({
        type: 'error',
        message: (err as Error).message || 'Failed to send resume email.',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Top Banner: Session loaded from Memory */}
      <div className="bg-gradient-to-r from-forest/10 via-sage-light to-neutral-50 border border-forest/20 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-forest bg-forest/15 px-2.5 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Loaded Session from Local Memory
            </span>
            <span className="text-xs text-muted flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-muted-dark" />
              {state.importedFile?.name || 'resume.docx'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-charcoal">
            {state.preferences.targetRole ? `${state.preferences.targetRole} Application` : 'Resume Optimization Session'}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Review chosen preferences, inspect accepted optimizations, download the document, or try new variations.
          </p>
        </div>

        {onOpenDrawer && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDrawer}
            className="text-xs gap-1.5 self-start sm:self-auto bg-white"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Switch Session
          </Button>
        )}
      </div>

      {/* Real-Time ATS Score Gauge */}
      <div>
        <AtsScoreGauge score={state.atsScore || null} />
      </div>

      {/* Main Grid: Preferences Chosen & Execution Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Panel 1: Preferences Chosen */}
        <div className="md:col-span-2 bg-white rounded-xl border border-border p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <h3 className="font-semibold text-charcoal text-sm flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-forest" /> Target Preferences
            </h3>
            <button
              onClick={() => dispatch({ type: 'SET_STEP', step: 'preferences' })}
              className="text-xs font-medium text-forest hover:text-forest-dark flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Edit Preferences
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
              <span className="text-muted text-[11px] block mb-0.5">Target Role</span>
              <span className="font-semibold text-charcoal text-xs">
                {state.preferences.targetRole || 'Not specified'}
              </span>
            </div>

            <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-100">
              <span className="text-muted text-[11px] block mb-0.5">Writing Style</span>
              <span className="font-semibold text-charcoal text-xs capitalize">
                {state.preferences.writingStyle || 'Achievement'}
              </span>
            </div>
          </div>

          {state.preferences.jobDescription && (
            <div className="pt-1">
              <span className="text-[11px] font-medium text-muted block mb-1">Target Job Description</span>
              <p className="text-xs text-charcoal/80 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100 line-clamp-3 leading-relaxed">
                {state.preferences.jobDescription}
              </p>
            </div>
          )}

          {state.preferences.scope && (
            <div className="text-[11px] text-muted flex items-center gap-2 pt-1">
              <span>Enhancement Scope:</span>
              <Badge variant="default" className="text-[10px] capitalize">
                {state.preferences.scope}
              </Badge>
            </div>
          )}
        </div>

        {/* Panel 2: Revision & Acceptance Stats */}
        <div className="bg-white rounded-xl border border-border p-4 shadow-xs space-y-3">
          <h3 className="font-semibold text-charcoal text-sm pb-2 border-b border-border/60 flex items-center justify-between">
            <span>Execution Summary</span>
            <Clock className="w-4 h-4 text-muted" />
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-100">
              <span className="flex items-center gap-1.5 font-medium text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Accepted
              </span>
              <span className="font-bold text-emerald-800">{acceptedBullets.length}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50/70 border border-rose-100">
              <span className="flex items-center gap-1.5 font-medium text-rose-900">
                <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rejected
              </span>
              <span className="font-bold text-rose-800">{rejectedBullets.length}</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-100">
              <span className="text-muted font-medium">Pending Review</span>
              <span className="font-bold text-charcoal">{pendingBullets.length}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px] text-muted">
              <span>Total Resume Bullets</span>
              <span className="font-semibold text-charcoal">{totalBullets}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Action Hub: 4 Key Controls */}
      <div className="bg-white rounded-xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
        <h3 className="font-semibold text-charcoal text-sm">Resume Actions & Next Steps</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Action 1: Download Word DOCX */}
          <Button
            variant="primary"
            icon={<FileDown className="w-4 h-4" />}
            onClick={handleDownloadDocx}
            disabled={isExporting}
            className="w-full text-xs justify-center"
            title="Download the updated formatted DOCX with accepted improvements"
          >
            {isExporting ? 'Exporting...' : 'Download DOCX'}
          </Button>

          {/* Action 2: Email Resume via Resend */}
          <Button
            variant="outline"
            icon={<Mail className="w-4 h-4 text-forest" />}
            onClick={() => setShowEmailModal(!showEmailModal)}
            className="w-full text-xs justify-center"
            title="Draft and send this resume directly via Resend API"
          >
            Email Resume
          </Button>

          {/* Action 3: Try with Other Preferences */}
          <Button
            variant="secondary"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => dispatch({ type: 'SET_STEP', step: 'preferences' })}
            className="w-full text-xs justify-center"
            title="Keep this resume but change target role, writing style, or JD to re-enhance"
          >
            Try Other Preferences
          </Button>

          {/* Action 4: Edit & Review Bullets */}
          <Button
            variant="ghost"
            icon={<Edit3 className="w-3.5 h-3.5" />}
            onClick={() => dispatch({ type: 'SET_STEP', step: 'results' })}
            className="w-full text-xs justify-center text-forest hover:bg-forest/10"
            title="Open bullet-by-bullet review to inspect diffs or tweak decisions"
          >
            Review All Bullets
          </Button>
        </div>

        {/* Resend Email Delivery Drawer */}
        {showEmailModal && (
          <div className="mt-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 animate-slide-down space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-charcoal text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600" /> Send Resume via Resend
              </h4>
              <span className="text-[11px] font-medium text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                https://resend.com
              </span>
            </div>
            <p className="text-xs text-muted">
              Auto-drafts a professional email with your enhanced Word document attached and dispatches via Resend.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-charcoal mb-1">
                  Recipient Email Address *
                </label>
                <input
                  type="email"
                  placeholder="e.g. recruiter@company.com"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-forest"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-charcoal mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-forest"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-charcoal mb-1">
                Optional Message
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Please find my updated resume attached for the position."
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-border rounded-lg bg-white focus:outline-none focus:border-forest resize-vertical"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted italic">
                Attached: {state.importedFile?.name ? `${state.importedFile.name.replace(/\.[^/.]+$/, '')}_enhanced.docx` : 'BulletBoost_Enhanced_Resume.docx'}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailStatus(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  icon={isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  onClick={handleSendEmail}
                  disabled={isSendingEmail || !emailRecipient.trim()}
                >
                  {isSendingEmail ? 'Sending via Resend...' : 'Send Email'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {exportSuccess && (
          <StatusIndicator type="success" message={exportSuccess} className="mt-2" />
        )}
        {exportError && (
          <StatusIndicator type="warning" message={exportError} className="mt-2" />
        )}
        {emailStatus && (
          <StatusIndicator type={emailStatus.type} message={emailStatus.message} className="mt-2" />
        )}
      </div>

      {/* Generated Resume Document Preview */}
      <div className="bg-white rounded-xl border border-border p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="font-semibold text-charcoal text-base">Generated Document Preview</h3>
            <p className="text-xs text-muted">
              Sections reflect original resume structure with accepted bullet improvements highlighted.
            </p>
          </div>
          <span className="text-xs font-semibold text-forest bg-forest/10 px-2.5 py-1 rounded-full">
            {acceptedBullets.length} improvements substituted
          </span>
        </div>

        <div className="space-y-5">
          {state.sections.map((sec) => (
            <div key={sec.id} className="space-y-2">
              <h4 className="text-xs font-bold text-forest tracking-wider uppercase border-b border-neutral-200 pb-1">
                {sec.title}
              </h4>
              <div className="space-y-2">
                {sec.bullets.map((b) => {
                  const isAccepted = acceptedMap.has(b.id);
                  const displayText = isAccepted ? acceptedMap.get(b.id) : b.text;

                  return (
                    <div
                      key={b.id}
                      className={`text-xs sm:text-sm leading-relaxed p-2.5 rounded-lg transition-all ${
                        isAccepted
                          ? 'bg-emerald-50/70 border border-emerald-200/80 text-emerald-950 font-medium'
                          : 'bg-neutral-50/50 text-charcoal'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-muted-dark select-none">•</span>
                        <div className="flex-1">
                          <span>{displayText}</span>
                          {isAccepted && (
                            <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                              ✓ Accepted Improvement
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
