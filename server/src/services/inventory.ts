import { getSetting } from "../db.js";
import { lanFetch } from "../lib/lanFetch.js";

/**
 * What the dashboard knows you actually run, with versions, so the CVE sweep
 * can ask "is *my* build affected?" rather than "does this product have
 * vulnerabilities?". Everything here is derived from integrations you already
 * configured — nothing is scanned or discovered on the network.
 */
export interface StackComponent {
  key: string;
  name: string;
  /** null when the service is configured but wouldn't tell us its version. */
  version: string | null;
  /** Where the version came from, shown in the UI so a wrong answer is debuggable. */
  source: string;
  /**
   * NVD CPE prefix (`cpe:2.3:part:vendor:product`) where one is known to exist.
   * With this we can ask NVD for version-range matches; without it we fall
   * back to a keyword search and can only report product-level hits.
   */
  cpe: string | null;
  /** NVD keywordSearch term. Used when there's no CPE, and for the *arr suite. */
  keyword: string;
}

/**
 * CPE names are not guessable — they're assigned by NVD analysts, and a wrong
 * one silently returns zero results. Only entries verified against real NVD
 * records are listed here; everything else deliberately falls back to keyword
 * search, which is imprecise but honest. Add a CPE here once you've confirmed
 * it appears in an actual advisory for that product.
 */
const KNOWN_CPE: Record<string, string> = {
  plex: "cpe:2.3:a:plex:media_server",
  docker: "cpe:2.3:a:docker:docker",
  runc: "cpe:2.3:a:linuxfoundation:runc",
  traefik: "cpe:2.3:a:traefik:traefik",
};

const TIMEOUT_MS = 8000;

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await lanFetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function base(key: string): string | null {
  const url = getSetting(`${key}_url`);
  return url ? url.replace(/\/+$/, "") : null;
}

/** Strip the build metadata *arr and Plex append, e.g. "1.32.7.7621-a4b2c" -> "1.32.7.7621". */
export function normalizeVersion(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const match = raw.trim().match(/^v?(\d+(?:\.\d+)*)/);
  return match ? match[1] : null;
}

function component(
  key: string,
  name: string,
  version: string | null,
  source: string,
  keyword: string
): StackComponent {
  return { key, name, version, source, cpe: KNOWN_CPE[key] ?? null, keyword };
}

/** Servarr apps (Sonarr/Radarr/Prowlarr) all expose the same status endpoint. */
async function servarr(
  key: string,
  name: string,
  apiVersion: "v1" | "v3"
): Promise<StackComponent | null> {
  const url = base(key);
  const apiKey = getSetting(`${key}_api_key`);
  if (!url || !apiKey) return null;
  let version: string | null = null;
  try {
    const data = await getJson(`${url}/api/${apiVersion}/system/status`, { "X-Api-Key": apiKey });
    version = normalizeVersion(data?.version);
  } catch {
    /* unreachable right now — still worth reporting product-level advisories */
  }
  return component(key, name, version, `${name} system/status`, name);
}

async function sabnzbd(): Promise<StackComponent | null> {
  const url = base("sabnzbd");
  const apiKey = getSetting("sabnzbd_api_key");
  if (!url || !apiKey) return null;
  let version: string | null = null;
  try {
    const params = new URLSearchParams({ mode: "version", output: "json", apikey: apiKey });
    version = normalizeVersion((await getJson(`${url}/api?${params}`))?.version);
  } catch {
    /* ignore */
  }
  return component("sabnzbd", "SABnzbd", version, "SABnzbd mode=version", "SABnzbd");
}

/**
 * Tautulli knows its own version and, more usefully, the version of the Plex
 * Media Server it's watching — which is the component here with a real history
 * of exploited-in-the-wild bugs (CVE-2020-5741 is in CISA KEV).
 */
async function tautulliAndPlex(): Promise<StackComponent[]> {
  const url = base("tautulli");
  const apiKey = getSetting("tautulli_api_key");
  if (!url || !apiKey) return [];

  const call = async (cmd: string) => {
    const params = new URLSearchParams({ apikey: apiKey, cmd });
    const body = await getJson(`${url}/api/v2?${params}`);
    if (body?.response?.result && body.response.result !== "success") {
      throw new Error(body.response.message || "Tautulli error");
    }
    return body?.response?.data;
  };

  const out: StackComponent[] = [];

  let tautulliVersion: string | null = null;
  try {
    // Tautulli reports its own release as the `tautulli_version` field of the
    // update check, which answers without contacting GitHub when up to date.
    const info = await call("update_check");
    tautulliVersion = normalizeVersion(info?.tautulli_version ?? info?.current_version);
  } catch {
    /* ignore */
  }
  out.push(component("tautulli", "Tautulli", tautulliVersion, "Tautulli update_check", "Tautulli"));

  try {
    const server = await call("get_server_info");
    const plexVersion = normalizeVersion(server?.pms_version);
    out.push(
      component("plex", "Plex Media Server", plexVersion, "Tautulli get_server_info", "Plex Media Server")
    );
  } catch {
    /* Plex version is a bonus; a Tautulli that won't answer isn't fatal */
  }

  return out;
}

/**
 * Portainer gives us two components for one integration: Portainer itself, and
 * the Docker engine it manages (it proxies the Docker Engine API straight
 * through, so that version is the daemon's own answer).
 */
async function portainerAndDocker(): Promise<StackComponent[]> {
  const url = base("portainer");
  const apiKey = getSetting("portainer_api_key");
  if (!url || !apiKey) return [];
  const endpointId = getSetting("portainer_endpoint_id") || "1";
  const headers = { "X-Api-Key": apiKey };
  const out: StackComponent[] = [];

  let portainerVersion: string | null = null;
  try {
    const status = await getJson(`${url}/api/system/status`, headers);
    portainerVersion = normalizeVersion(status?.Version);
  } catch {
    /* ignore */
  }
  out.push(component("portainer", "Portainer", portainerVersion, "Portainer system/status", "Portainer"));

  try {
    const docker = await getJson(`${url}/api/endpoints/${endpointId}/docker/version`, headers);
    const engine = normalizeVersion(docker?.Version);
    out.push(component("docker", "Docker Engine", engine, "Docker engine version", "Docker Engine"));

    // runc ships as a Docker component and is where container-escape bugs
    // land (CVE-2024-21626), so it's worth tracking separately from the daemon.
    const runc = (docker?.Components ?? []).find(
      (c: any) => typeof c?.Name === "string" && c.Name.toLowerCase() === "runc"
    );
    const runcVersion = normalizeVersion(runc?.Version);
    if (runcVersion) {
      out.push(component("runc", "runc", runcVersion, "Docker engine components", "runc"));
    }
  } catch {
    /* ignore */
  }

  return out;
}

let cache: { at: number; stack: StackComponent[] } | null = null;
const CACHE_MS = 30 * 60 * 1000;

export async function detectStack(force = false): Promise<StackComponent[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.stack;

  const groups = await Promise.all([
    servarr("sonarr", "Sonarr", "v3").then((c) => (c ? [c] : [])),
    servarr("radarr", "Radarr", "v3").then((c) => (c ? [c] : [])),
    servarr("prowlarr", "Prowlarr", "v1").then((c) => (c ? [c] : [])),
    sabnzbd().then((c) => (c ? [c] : [])),
    tautulliAndPlex(),
    portainerAndDocker(),
  ]);

  const stack = groups.flat();
  cache = { at: Date.now(), stack };
  return stack;
}

export function invalidateInventoryCache() {
  cache = null;
}
