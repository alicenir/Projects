import { getSetting } from "../db.js";
import { lanFetch } from "../lib/lanFetch.js";

export interface ContainerStatus {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  stack: string | null;
}

export interface PortainerSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;
  total: number;
  running: number;
  /** Anything not "running" — exited, restarting, dead, paused, created. */
  problem: ContainerStatus[];
}

export interface PortainerEndpoint {
  id: number;
  name: string;
  status: "up" | "down";
}

function config(): { url: string; apiKey: string; endpointId: string } | null {
  const url = getSetting("portainer_url");
  const apiKey = getSetting("portainer_api_key");
  if (!url || !apiKey) return null;
  return {
    url: url.replace(/\/+$/, ""),
    apiKey,
    endpointId: getSetting("portainer_endpoint_id") || "1",
  };
}

async function call(path: string, override?: { url: string; apiKey: string }) {
  const cfg = override ?? config();
  if (!cfg) throw new Error("not_configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await lanFetch(`${cfg.url}${path}`, {
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

function empty(configured: boolean, error?: string): PortainerSnapshot {
  return { configured, reachable: false, error, total: 0, running: 0, problem: [] };
}

export async function getStatus(): Promise<PortainerSnapshot> {
  const cfg = config();
  if (!cfg) return empty(false);

  try {
    // Portainer proxies the Docker Engine API directly under this path, so
    // this is live container state from the daemon — not a cached snapshot.
    const containers = await call(
      `/api/endpoints/${cfg.endpointId}/docker/containers/json?all=true`
    );

    const list: ContainerStatus[] = (Array.isArray(containers) ? containers : []).map((c: any) => ({
      id: c.Id,
      name: (c.Names?.[0] ?? "").replace(/^\//, "") || c.Id?.slice(0, 12) || "unknown",
      image: c.Image ?? "",
      state: c.State ?? "unknown",
      status: c.Status ?? "",
      stack: c.Labels?.["com.docker.compose.project"] ?? null,
    }));

    return {
      configured: true,
      reachable: true,
      total: list.length,
      running: list.filter((c) => c.state === "running").length,
      problem: list
        .filter((c) => c.state !== "running")
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  } catch (err) {
    return empty(true, err instanceof Error ? err.message : "unreachable");
  }
}

export async function listEndpoints(
  url: string,
  apiKey: string
): Promise<{ ok: boolean; error?: string; endpoints?: PortainerEndpoint[] }> {
  try {
    const data = await call("/api/endpoints", { url: url.replace(/\/+$/, ""), apiKey });
    if (!Array.isArray(data)) return { ok: false, error: "Unexpected response" };
    return {
      ok: true,
      endpoints: data.map((e: any) => ({
        id: e.Id,
        name: e.Name ?? `Endpoint ${e.Id}`,
        status: e.Status === 1 ? "up" : "down",
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  }
}
