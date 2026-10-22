import type { ReactNode } from 'react';
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  title?: string;
}

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-sage text-charcoal',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  error: 'bg-error-bg text-error',
  info: 'bg-sage-light text-forest',
};

export function Badge({
  variant = 'default',
  children,
  className = '',
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded
        ${badgeStyles[variant]} ${className}
      `}
    >
      {children}
    </span>
  );
}

// ── Status indicator ────────────────────────────────────────────────

type StatusType = 'info' | 'success' | 'warning' | 'error';

interface StatusIndicatorProps {
  type: StatusType;
  message: string;
  className?: string;
}

const statusIcons: Record<StatusType, ReactNode> = {
  info: <Info className="w-4 h-4 text-forest flex-shrink-0" />,
  success: <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />,
  error: <XCircle className="w-4 h-4 text-error flex-shrink-0" />,
};

const statusStyles: Record<StatusType, string> = {
  info: 'bg-sage-light border-sage text-charcoal',
  success: 'bg-success-bg border-green-200 text-charcoal',
  warning: 'bg-warning-bg border-amber-200 text-charcoal',
  error: 'bg-error-bg border-red-200 text-charcoal',
};

export function StatusIndicator({
  type,
  message,
  className = '',
}: StatusIndicatorProps) {
  return (
    <div
      className={`
        flex items-start gap-2.5 px-3.5 py-2.5 rounded-md border text-sm
        ${statusStyles[type]} ${className}
      `}
      role={type === 'error' ? 'alert' : 'status'}
    >
      {statusIcons[type]}
      <span>{message}</span>
    </div>
  );
}

// ── Demo indicator ──────────────────────────────────────────────────

export function DemoIndicator({ className = '' }: { className?: string }) {
  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
        bg-warning-bg text-warning border border-amber-200
        ${className}
      `}
    >
      <Info className="w-3 h-3" />
      Demo Data
    </div>
  );
}
