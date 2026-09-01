import { db, getSetting } from "../db.js";
import { detectStack, type StackComponent } from "./inventory.js";
import { assessCve, buildFinding, type EpssEntry, type Finding } from "./cveScoring.js";

export type { EpssEntry, Finding, FindingStatus, RiskLevel } from "./cveScoring.js";

/**
 * Known-vulnerability tracking for the software this dashboard already talks
 * to. Two public, keyless APIs are used:
 *
 *   NVD 2.0   — the CVE records themselves, including the CPE version ranges
 *               that say whether *your* build is in scope, and the
 *               `cisaExploitAdd` field that mirrors CISA's Known Exploited
 *               Vulnerabilities catalog (so KEV needs no separate feed).
 *   EPSS      — FIRST's daily model of how likely a CVE is to be exploited in
 *               the next 30 days, which is what separates "critical on paper"
 *               from "critical in practice".
 *
 * Requests carry product names and version numbers only — never a URL, API key
 * or anything else about your network.
 */

const NVD_URL = process.env.NVD_API_URL ?? "https://services.nvd.nist.gov/rest/json/cves/2.0";
const EPSS_URL = process.env.EPSS_API_URL ?? "https://api.first.org/data/v1/epss";

export interface ComponentReport {
  key: string;
  name: string;
  version: string | null;
  source: string;
  matchMode: "cpe" | "keyword";
  scanned: boolean;
  error: string | null;
  truncated: boolean;
  findings: Finding[];
}

export interface SecuritySnapshot {
  enabled: boolean;
  configured: boolean;
  scanning: boolean;
  scannedAt: string | null;
  error: string | null;
  components: ComponentReport[];
  findings: Finding[];
  counts: { total: number; critical: number; high: number; medium: number; low: number; kev: number };
}

/* ------------------------------------------------------------------ *
 * NVD + EPSS clients
 * ------------------------------------------------------------------ */

/**
 * NVD allows 5 requests per rolling 30s without an API key and 50 with one.
 * Every call goes through this queue so a sweep can never trip the limit and
 * get the whole dashboard temporarily banned.
 */
let chain: Promise<unknown> = Promise.resolve();

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const spacing = getSetting("nvd_api_key") ? 800 : 6500;
  const run = chain.then(async () => {
    const result = await fn();
    await new Promise((resolve) => setTimeout(resolve, spacing));
    return result;
  });
  chain = run.catch(() => undefined);
  return run as Promise<T>;
}

const RETRYABLE = new Set([403, 429, 503]);

async function nvdAttempt(query: string): Promise<any> {
  const apiKey = getSetting("nvd_api_key");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${NVD_URL}?${query}`, {
      headers: apiKey ? { apiKey } : {},
      signal: controller.signal,
    });
    if (!res.ok) {
      const error = new Error(`NVD HTTP ${res.status}`) as Error & { status?: number };
      error.status = res.status;
      throw error;
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function nvdRequest(query: string): Promise<any> {
  return throttle(async () => {
    try {
      return await nvdAttempt(query);
    } catch (err) {
      // NVD answers 403/429 when a caller has run hot and 503 when it's under
      // load; both clear on their own, so one patient retry saves the whole
      // component's scan. Anything else is a real error.
      const status = (err as { status?: number }).status;
      if (!status || !RETRYABLE.has(status)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 30_000));
      return await nvdAttempt(query);
    }
  });
}

const PAGE_SIZE = 200;
const MAX_PAGES = 5;

async function nvdSearch(params: string): Promise<{ cves: any[]; truncated: boolean }> {
  const cves: any[] = [];
  let startIndex = 0;
  let truncated = false;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data = await nvdRequest(`${params}&resultsPerPage=${PAGE_SIZE}&startIndex=${startIndex}`);
    for (const entry of data?.vulnerabilities ?? []) {
      if (entry?.cve) cves.push(entry.cve);
    }
    const total = Number(data?.totalResults ?? cves.length);
    startIndex += PAGE_SIZE;
    if (startIndex >= total) break;
    if (page === MAX_PAGES - 1) truncated = true;
  }

  return { cves, truncated };
}

/**
 * Ask NVD the most precise question the available data supports, and fall back
 * gracefully. `isVulnerable` makes NVD do the version-range maths server-side;
 * we redo it locally anyway, so a fallback never loses correctness — only
 * bandwidth.
 */
async function fetchForComponent(component: StackComponent): Promise<{ cves: any[]; truncated: boolean }> {
  if (component.cpe) {
    if (component.version) {
      try {
        const exact = encodeURIComponent(`${component.cpe}:${component.version}`);
        return await nvdSearch(`virtualMatchString=${exact}&isVulnerable&noRejected`);
      } catch {
        /* fall through to the product-wide query */
      }
    }
    try {
      const product = encodeURIComponent(component.cpe);
      return await nvdSearch(`virtualMatchString=${product}&noRejected`);
    } catch {
      /* fall through to keyword search */
    }
  }
  return nvdSearch(`keywordSearch=${encodeURIComponent(component.keyword)}&noRejected`);
}

/** EPSS takes up to a few hundred CVEs per call; batch to keep it to one or two. */
export async function fetchEpss(ids: string[]): Promise<Map<string, EpssEntry>> {
  const out = new Map<string, EpssEntry>();
  const unique = [...new Set(ids)].filter(Boolean);

  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${EPSS_URL}?cve=${batch.join(",")}`, { signal: controller.signal });
      if (!res.ok) continue;
      const body = await res.json();
      for (const row of body?.data ?? []) {
        const epss = Number.parseFloat(row?.epss);
        const percentile = Number.parseFloat(row?.percentile);
        if (row?.cve && Number.isFinite(epss)) {
          out.set(row.cve, { epss, percentile: Number.isFinite(percentile) ? percentile : 0 });
        }
      }
    } catch {
      /* EPSS is an enrichment — a miss just means scoring without it */
    } finally {
      clearTimeout(timeout);
    }
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Scan orchestration + cache
 * ------------------------------------------------------------------ */

const STALE_MS = 12 * 60 * 60 * 1000;

const readCache = db.prepare("SELECT component, version, fetched_at, payload FROM cve_cache");
const writeCache = db.prepare(
  `INSERT INTO cve_cache (component, version, fetched_at, payload)
   VALUES (?, ?, ?, ?)
   ON CONFLICT(component) DO UPDATE SET
     version = excluded.version, fetched_at = excluded.fetched_at, payload = excluded.payload`
);
const dropCache = db.prepare("DELETE FROM cve_cache WHERE component = ?");

interface CacheRow {
  component: string;
  version: string | null;
  fetched_at: number;
  payload: string;
}

function cachedReports(): Map<string, { at: number; version: string | null; report: ComponentReport }> {
  const out = new Map<string, { at: number; version: string | null; report: ComponentReport }>();
  for (const row of readCache.all() as CacheRow[]) {
    try {
      out.set(row.component, {
        at: row.fetched_at,
        version: row.version,
        report: JSON.parse(row.payload) as ComponentReport,
      });
    } catch {
      dropCache.run(row.component);
    }
  }
  return out;
}

async function scanComponent(component: StackComponent): Promise<ComponentReport> {
  const report: ComponentReport = {
    key: component.key,
    name: component.name,
    version: component.version,
    source: component.source,
    matchMode: component.cpe ? "cpe" : "keyword",
    scanned: false,
    error: null,
    truncated: false,
    findings: [],
  };

  let cves: any[];
  try {
    const result = await fetchForComponent(component);
    cves = result.cves;
    report.truncated = result.truncated;
  } catch (err) {
    report.error = err instanceof Error ? err.message : "lookup failed";
    return report;
  }

  const applicable = cves.filter((c) => assessCve(c, component.cpe, component.version) !== null);
  const epss = await fetchEpss(applicable.map((c) => c?.id).filter(Boolean));

  report.scanned = true;
  report.findings = applicable
    .map((cve) => buildFinding(cve, component, epss.get(cve?.id) ?? null))
    .filter((f): f is Finding => f !== null)
    .sort((a, b) => b.score - a.score);

  return report;
}

let scanning = false;
let lastScanAt: number | null = null;
let lastError: string | null = null;

export async function runScan(force = false): Promise<void> {
  if (scanning) return;
  if (getSetting("security_enabled") !== "true") return;

  scanning = true;
  lastError = null;
  try {
    const stack = await detectStack(force);
    const cache = cachedReports();
    const live = new Set(stack.map((c) => c.key));

    for (const key of cache.keys()) {
      if (!live.has(key)) dropCache.run(key);
    }

    for (const component of stack) {
      const cached = cache.get(component.key);
      const fresh =
        cached &&
        Date.now() - cached.at < STALE_MS &&
        cached.version === component.version &&
        cached.report.scanned;
      if (!force && fresh) continue;

      const report = await scanComponent(component);
      // Don't let a transient failure erase a good result we already have.
      if (!report.scanned && cached?.report.scanned) continue;
      writeCache.run(component.key, component.version, Date.now(), JSON.stringify(report));
    }

    lastScanAt = Date.now();
  } catch (err) {
    lastError = err instanceof Error ? err.message : "scan failed";
  } finally {
    scanning = false;
  }
}

export async function getSecurityStatus(): Promise<SecuritySnapshot> {
  const enabled = getSetting("security_enabled") === "true";
  const cache = cachedReports();
  const components = [...cache.values()]
    .map((entry) => entry.report)
    .sort((a, b) => a.name.localeCompare(b.name));

  const findings = components.flatMap((c) => c.findings).sort((a, b) => b.score - a.score);
  const newestScan = [...cache.values()].reduce((max, entry) => Math.max(max, entry.at), 0);
  const scannedAt = lastScanAt ?? (newestScan || null);

  return {
    enabled,
    configured: enabled && (components.length > 0 || scanning),
    scanning,
    scannedAt: scannedAt ? new Date(scannedAt).toISOString() : null,
    error: lastError,
    components,
    findings,
    counts: {
      total: findings.length,
      critical: findings.filter((f) => f.level === "critical").length,
      high: findings.filter((f) => f.level === "high").length,
      medium: findings.filter((f) => f.level === "medium").length,
      low: findings.filter((f) => f.level === "low").length,
      kev: findings.filter((f) => f.kev).length,
    },
  };
}

let pollHandle: ReturnType<typeof setTimeout> | null = null;

export function startSecurityPolling(): void {
  const tick = async () => {
    try {
      await runScan();
    } catch {
      /* keep the timer alive regardless */
    }
    pollHandle = setTimeout(tick, 6 * 60 * 60 * 1000);
  };
  // Let the rest of the server come up first; the sweep is deliberately slow.
  pollHandle = setTimeout(tick, 20_000);
}

export function stopSecurityPolling(): void {
  if (pollHandle) clearTimeout(pollHandle);
}
