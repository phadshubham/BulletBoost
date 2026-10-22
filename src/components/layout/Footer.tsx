import { Zap } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-white mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted text-sm">
          <Zap className="w-3.5 h-3.5" />
          <span>BulletBoost</span>
          <span className="text-border-dark">·</span>
          <span>Resume enhancement prototype</span>
        </div>
        <p className="text-xs text-muted-light">
          Built for demonstration purposes. Not connected to a production backend.
        </p>
      </div>
    </footer>
  );
}
