import { getSetting } from "../db.js";

export interface IndexerStatus {
  id: number;
  name: string;
  protocol: "usenet" | "torrent" | "unknown";
  enabled: boolean;
  /** Currently blocked by Prowlarr due to repeated failures. */
  blocked: boolean;
  disabledTill: string | null;
  failureReason: string | null;
}

export interface ProwlarrIssue {
  type: "warning" | "error";
  message: string;
}

export interface ProwlarrSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;
  total: number;
  enabled: number;
  healthy: number;
  indexers: IndexerStatus[];
  issues: ProwlarrIssue[];
}

function config(): { url: string; apiKey: string } | null {
  const url = getSetting("prowlarr_url");
  const apiKey = getSetting("prowlarr_api_key");
  if (!url || !apiKey) return null;
  return { url: url.replace(/\/+$/, ""), apiKey };
}

async function call(path: string, override?: { url: string; apiKey: string }) {
  const cfg = override ?? config();
  if (!cfg) throw new Error("not_configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      headers: { "X-Api-Key": cfg.apiKey },
      signal: controller.signal,
    });
    if (res.status === 401) throw new Error("Invalid API key");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function empty(configured: boolean, error?: string): ProwlarrSnapshot {
  return { configured, reachable: false, error, total: 0, enabled: 0, healthy: 0, indexers: [], issues: [] };
}

export async function getStatus(): Promise<ProwlarrSnapshot> {
  if (!config()) return empty(false);

  try {
    const [indexers, statuses, health] = await Promise.all([
      call("/api/v1/indexer"),
      // Older Prowlarr builds don't have this endpoint yet; treat as "no blocks known".
      call("/api/v1/indexerstatus").catch(() => []),
      call("/api/v1/health").catch(() => []),
    ]);

    const statusById = new Map<number, any>(
      (Array.isArray(statuses) ? statuses : []).map((s: any) => [s.indexerId, s])
    );

    const list: IndexerStatus[] = (Array.isArray(indexers) ? indexers : []).map((idx: any) => {
      const status = statusById.get(idx.id);
      const disabledTill: string | null = status?.disabledTill ?? null;
      const blocked = Boolean(disabledTill && new Date(disabledTill).getTime() > Date.now());
      return {
        id: idx.id,
        name: idx.name ?? "Unknown",
        protocol: idx.protocol === "usenet" || idx.protocol === "torrent" ? idx.protocol : "unknown",
        enabled: Boolean(idx.enable),
        blocked,
        disabledTill,
        failureReason: status?.mostRecentFailureMessage ?? status?.disabledReason ?? null,
      };
    });

    const enabledIndexers = list.filter((i) => i.enabled);

    return {
      configured: true,
      reachable: true,
      total: list.length,
      enabled: enabledIndexers.length,
      healthy: enabledIndexers.filter((i) => !i.blocked).length,
      indexers: list.sort((a, b) => a.name.localeCompare(b.name)),
      issues: (Array.isArray(health) ? health : [])
        .filter((h: any) => h.type === "warning" || h.type === "error")
        .map((h: any) => ({ type: h.type, message: h.message ?? "" })),
    };
  } catch (err) {
    return empty(true, err instanceof Error ? err.message : "unreachable");
  }
}

export async function testConnection(url: string, apiKey: string) {
  try {
    const base = { url: url.replace(/\/+$/, ""), apiKey };
    const data = await call("/api/v1/system/status", base);
    return { ok: true, version: data?.version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  }
}
