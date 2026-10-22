import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useAppState, useAppDispatch, refreshBackendHealth } from '../../context/AppContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { backendHealth } = useAppState();
  const dispatch = useAppDispatch();
  const [dismissed, setDismissed] = useState(false);

  return (
    <>
      <Header />
      {backendHealth.status === 'disconnected' && !dismissed && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 animate-fade-in">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                FastAPI backend is offline at{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px] font-semibold text-amber-950">
                  {backendHealth.apiUrl}
                </code>
                . Real parsing and AI enhancements require the server. Run{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[11px] font-semibold text-amber-950">
                  .\start_local.ps1
                </code>{' '}
                to launch it.
              </span>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
              <button
                onClick={() => refreshBackendHealth(dispatch)}
                className="font-medium text-amber-900 underline hover:text-amber-950 text-xs flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry Connection
              </button>
              <button
                onClick={() => setDismissed(true)}
                className="text-amber-700 hover:text-amber-900 p-0.5 cursor-pointer"
                aria-label="Dismiss warning"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
