import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../lib/api";
import { useStore } from "../store/useStore";
import type { Finding, RiskLevel, SecuritySnapshot } from "../types";

const LEVEL_COLOR: Record<RiskLevel, string> = {
  critical: "#f87171",
  high: "#fb923c",
  medium: "#fbbf24",
  low: "#94a3b8",
};

function relative(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return "never";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** EPSS is a probability; as a percentage it reads far better at a glance. */
function epssLabel(finding: Finding): string | null {
  if (finding.epss === null) return null;
  const percent = finding.epss * 100;
  return `EPSS ${percent >= 1 ? `${Math.round(percent)}%` : "<1%"}`;
}

function FindingRow({ finding }: { finding: Finding }) {
  const epss = epssLabel(finding);
  return (
    <li>
      <a
        href={finding.url}
        target="_blank"
        rel="noreferrer noopener"
        className="flex flex-col gap-1 rounded-xl sunken px-3 py-2 transition hover:bg-white/5"
        title={finding.summary}
      >
        <div className="flex items-center gap-2 text-xs">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: LEVEL_COLOR[finding.level] }}
          />
          <span className="shrink-0 font-mono font-medium text-ink">{finding.id}</span>
          {finding.kev && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-300 bg-red-500/15">
              Exploited
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-right text-ink-muted">
            {finding.componentName}
            {finding.version ? ` ${finding.version}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-3.5 text-[10px] text-ink-muted">
          {finding.cvss !== null && <span>CVSS {finding.cvss.toFixed(1)}</span>}
          {epss && (
            <span title="Chance of exploitation in the next 30 days, per FIRST's EPSS model">
              {epss}
            </span>
          )}
          {finding.fixedIn && <span className="text-emerald-400">fixed in {finding.fixedIn}</span>}
          {finding.status !== "affected" && (
            <span
              className="italic"
              title={
                finding.status === "possible"
                  ? "This product is affected, but we couldn't read your installed version."
                  : "NVD has no version data for this advisory — check it by hand."
              }
            >
              {finding.status === "possible" ? "version unconfirmed" : "unversioned advisory"}
            </span>
          )}
        </div>
      </a>
    </li>
  );
}

export function SecurityWidget() {
  const [snapshot, setSnapshot] = useState<SecuritySnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const authed = useStore((s) => s.authed);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<SecuritySnapshot>("/security/status");
        if (!cancelled) setSnapshot(data);
      } catch {
        /* leave the widget hidden */
      }
    }
    load();
    // A sweep runs every six hours server-side; poll often enough to notice a
    // manual rescan finishing, rarely enough to be free.
    const id = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function rescan() {
    setRefreshing(true);
    try {
      await api.post("/security/refresh");
      toast.success("Rescanning — this takes a minute");
      setSnapshot((s) => (s ? { ...s, scanning: true } : s));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rescan failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (!snapshot || !snapshot.configured) return null;

  const { counts, findings } = snapshot;
  const checked = snapshot.components.filter((c) => c.scanned);
  const failed = snapshot.components.filter((c) => !c.scanned);
  // The first sweep after setup has no results yet — that's pending, not clean.
  const pending = snapshot.scanning && snapshot.components.length === 0;
  // Nothing checked is emphatically not the same as nothing found — if the CVE
  // database was unreachable, saying "all clear" would be a lie.
  const blocked = !pending && checked.length === 0;
  const clean = !pending && !blocked && findings.length === 0;
  const visible = expanded ? findings.slice(0, 25) : findings.slice(0, 4);
  // NVD paging is capped, so a product with a very long history can come back
  // partial — say so rather than implying the list is exhaustive.
  const partial = snapshot.components.some((c) => c.truncated);

  const headline = snapshot.scanning
    ? "Scanning…"
    : blocked
      ? `Couldn't check ${failed.length} component${failed.length === 1 ? "" : "s"}`
      : clean
        ? `${checked.length} component${checked.length === 1 ? "" : "s"} clean`
        : `${counts.total} finding${counts.total === 1 ? "" : "s"} across ${checked.length} components`;

  const badge = pending
    ? { text: "Scanning", color: "#94a3b8" }
    : blocked
      ? { text: "Unchecked", color: "#fbbf24" }
      : clean
        ? { text: "All clear", color: "#34d399" }
        : {
            text: counts.kev > 0 ? `${counts.kev} exploited` : `${counts.critical + counts.high} urgent`,
            color: LEVEL_COLOR[findings[0].level],
          };

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3 4.5 6v6c0 4.2 3 8.1 7.5 9 4.5-.9 7.5-4.8 7.5-9V6L12 3Z" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold leading-tight text-ink">Vulnerabilities</h2>
          <p className="truncate text-xs text-ink-muted">{headline}</p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: `${badge.color}26`, color: badge.color }}
        >
          {badge.text}
        </span>
      </div>

      {snapshot.error && (
        <p className="mb-2 rounded-xl bg-red-500/10 px-3.5 py-2 text-[11px] text-red-300">
          {snapshot.error}
        </p>
      )}

      {pending ? (
        <p className="py-3 text-center text-sm text-ink-muted">Checking your stack…</p>
      ) : blocked ? (
        <p className="rounded-xl bg-amber-500/10 px-3.5 py-3 text-xs text-amber-300">
          {failed[0]?.error ?? "The CVE database is unreachable"} — no vulnerability data was
          retrieved, so this is not an all-clear.
        </p>
      ) : clean ? (
        <p className="py-3 text-center text-sm text-ink-muted">
          No known vulnerabilities affect your installed versions.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {visible.map((finding) => (
              <FindingRow key={`${finding.component}-${finding.id}`} finding={finding} />
            ))}
          </ul>
          {findings.length > visible.length && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-2 w-full text-center text-[11px] text-ink-muted transition hover:text-ink"
            >
              Show {findings.length - visible.length} more
            </button>
          )}
          {expanded && (
            <button
              onClick={() => setExpanded(false)}
              className="mt-2 w-full text-center text-[11px] text-ink-muted transition hover:text-ink"
            >
              Show less
            </button>
          )}
        </>
      )}

      <div className="mt-3 hairline flex items-center gap-2 border-t pt-2.5 text-[10px] text-ink-muted">
        <span className="min-w-0 flex-1 truncate">
          Checked {relative(snapshot.scannedAt)}
          {partial && " · partial results"}
          {!blocked && failed.length > 0 && ` · ${failed.length} unchecked`}
        </span>
        {authed && (
          <button
            onClick={rescan}
            disabled={refreshing || snapshot.scanning}
            className="shrink-0 transition hover:text-ink disabled:opacity-40"
          >
            {snapshot.scanning ? "Scanning…" : "Rescan"}
          </button>
        )}
      </div>
    </section>
  );
}
