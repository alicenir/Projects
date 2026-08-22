import type { ReactNode } from "react";

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      {icon && <div className="text-ink-muted">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-xs text-xs text-ink-muted">{description}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-alert-soft py-8 text-center">
      <p className="text-sm font-medium text-alert">Couldn't load this section</p>
      <p className="max-w-xs text-xs text-alert/80">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg border border-alert/30 px-3 py-1 text-xs font-medium text-alert hover:bg-alert/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}
