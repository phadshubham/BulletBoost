import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap, Menu, X, RefreshCw, Loader2 } from 'lucide-react';
import { useAppState, useAppDispatch, refreshBackendHealth } from '../../context/AppContext';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/enhance', label: 'Enhance Resume' },
  { to: '/evaluation', label: 'Evaluation Lab' },
  { to: '/about', label: 'About' },
];

export function Header() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { backendHealth } = useAppState();
  const dispatch = useAppDispatch();

  const renderBackendBadge = (isMobile: boolean = false) => {
    if (backendHealth.status === 'connected') {
      return (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 ${
            isMobile ? 'self-start mt-2' : ''
          }`}
          title={`Connected to ${backendHealth.apiUrl} (v${backendHealth.version || '0.1.0'})`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Backend Ready</span>
        </div>
      );
    }
    if (backendHealth.status === 'disconnected') {
      return (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200 ${
            isMobile ? 'self-start mt-2' : ''
          }`}
          title={backendHealth.error || `Unreachable at ${backendHealth.apiUrl}`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>Backend Offline</span>
          <button
            onClick={() => refreshBackendHealth(dispatch)}
            className="p-0.5 hover:text-rose-950 rounded focus:outline-none transition-colors"
            title="Retry connection to backend"
            aria-label="Retry backend connection"
          >
            <RefreshCw className="w-3 h-3 hover:rotate-180 transition-transform" />
          </button>
        </div>
      );
    }
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 ${
          isMobile ? 'self-start mt-2' : ''
        }`}
      >
        <Loader2 className="w-3 h-3 animate-spin text-neutral-500" />
        <span>Checking...</span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 text-charcoal hover:text-forest transition-colors focus-ring rounded"
        >
          <div className="w-7 h-7 rounded-md bg-forest flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[15px] tracking-tight">
            BulletBoost
          </span>
        </Link>

        {/* Desktop nav & backend status indicator */}
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map(({ to, label }) => {
              const isActive =
                to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`
                    px-3 py-1.5 text-sm rounded-md transition-colors duration-150 focus-ring
                    ${
                      isActive
                        ? 'text-forest font-medium bg-sage-light'
                        : 'text-muted hover:text-charcoal hover:bg-sage-light'
                    }
                  `}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="h-4 w-px bg-border" />
          {renderBackendBadge(false)}
        </div>

        {/* Mobile menu button and badge */}
        <div className="md:hidden flex items-center gap-2">
          {renderBackendBadge(false)}
          <button
            className="p-2 text-muted hover:text-charcoal focus-ring rounded"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <nav
          className="md:hidden border-t border-border bg-white animate-fade-in"
          aria-label="Mobile navigation"
        >
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col gap-0.5">
            {navLinks.map(({ to, label }) => {
              const isActive =
                to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMenuOpen(false)}
                  className={`
                    px-3 py-2 text-sm rounded-md transition-colors duration-150 focus-ring
                    ${
                      isActive
                        ? 'text-forest font-medium bg-sage-light'
                        : 'text-muted hover:text-charcoal hover:bg-sage-light'
                    }
                  `}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
