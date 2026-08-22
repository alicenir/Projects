interface Props {
  children: React.ReactNode;
  color?: string;
  count?: number;
  /** Top-level section label ("Applications", "Bookmarks") vs. a category label. */
  major?: boolean;
}

export function SectionHeading({ children, color, count, major }: Props) {
  if (major) {
    return (
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg font-extrabold uppercase tracking-[0.16em] text-ink">{children}</h2>
        {count !== undefined && (
          <span className="text-xs font-semibold tabular-nums text-ink-muted">{count}</span>
        )}
        <span className="hairline mt-1 h-px flex-1 border-t" aria-hidden />
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span
        className="h-4 w-1 rounded-full"
        style={{ backgroundColor: color ?? "var(--accent)" }}
        aria-hidden
      />
      <h3
        className="text-[13px] font-extrabold uppercase tracking-[0.14em]"
        style={{ color: color ?? "var(--accent)" }}
      >
        {children}
      </h3>
      {count !== undefined && (
        <span className="text-[11px] font-medium tabular-nums text-ink-muted">{count}</span>
      )}
    </div>
  );
}
