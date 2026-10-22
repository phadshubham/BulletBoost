import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export function Input({
  label,
  helperText,
  error,
  id,
  className = '',
  ...props
}: InputProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-charcoal"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`
          w-full px-3 py-2 text-sm rounded-md border bg-white
          text-charcoal placeholder:text-muted-light
          transition-colors duration-150 focus-ring
          ${error ? 'border-error' : 'border-border hover:border-border-dark focus:border-forest'}
        `}
        {...props}
      />
      {helperText && !error && (
        <p className="text-xs text-muted">{helperText}</p>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

// ── Textarea ────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export function Textarea({
  label,
  helperText,
  error,
  id,
  className = '',
  ...props
}: TextareaProps) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className="text-sm font-medium text-charcoal"
      >
        {label}
      </label>
      <textarea
        id={inputId}
        className={`
          w-full px-3 py-2.5 text-sm rounded-md border bg-white
          text-charcoal placeholder:text-muted-light resize-vertical
          transition-colors duration-150 focus-ring leading-relaxed
          ${error ? 'border-error' : 'border-border hover:border-border-dark focus:border-forest'}
        `}
        {...props}
      />
      {helperText && !error && (
        <p className="text-xs text-muted">{helperText}</p>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
