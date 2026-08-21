import type { Server } from "socket.io";
import { getSetting } from "../db.js";

export interface PlexStream {
  key: string;
  user: string;
  title: string;
  subtitle: string;
  kind: string;
  progress: number;
  state: string;
  transcoding: boolean;
  quality: string;
  player: string;
  thumb: string | null;
  durationMs: number | null;
  viewOffsetMs: number | null;
}

export interface TautulliSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;
  streamCount: number;
  totalBandwidth: number | null;
  streams: PlexStream[];
}

function config(): { url: string; apiKey: string } | null {
  const url = getSetting("tautulli_url");
  const apiKey = getSetting("tautulli_api_key");
  if (!url || !apiKey) return null;
  return { url: url.replace(/\/+$/, ""), apiKey };
}

async function call(cmd: string, extra: Record<string, string> = {}, override?: { url: string; apiKey: string }) {
  const cfg = override ?? config();
  if (!cfg) throw new Error("not_configured");

  const params = new URLSearchParams({ apikey: cfg.apiKey, cmd, ...extra });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${cfg.url}/api/v2?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    // Tautulli always returns 200; failures show up in the envelope.
    const result = body?.response?.result;
    if (result && result !== "success") {
      throw new Error(body?.response?.message || "Tautulli returned an error");
    }
    return body?.response?.data;
  } finally {
    clearTimeout(timeout);
  }
}

function empty(configured: boolean, error?: string): TautulliSnapshot {
  return { configured, reachable: false, error, streamCount: 0, totalBandwidth: null, streams: [] };
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export async function getActivity(): Promise<TautulliSnapshot> {
  if (!config()) return empty(false);

  try {
    const data = await call("get_activity");
    const sessions: any[] = data?.sessions ?? [];

    return {
      configured: true,
      reachable: true,
      streamCount: num(data?.stream_count) ?? sessions.length,
      totalBandwidth: num(data?.total_bandwidth),
      streams: sessions.map((s) => {
        const duration = num(s.duration);
        const offset = num(s.view_offset);
        const isEpisode = s.media_type === "episode";
        const subtitle = isEpisode
          ? `S${String(s.parent_media_index ?? 0).padStart(2, "0")}E${String(
              s.media_index ?? 0
            ).padStart(2, "0")} · ${s.title ?? ""}`
          : String(s.year ?? "");

        return {
          key: String(s.session_key ?? s.session_id ?? `${s.user}-${s.rating_key}`),
          user: s.friendly_name ?? s.user ?? "Someone",
          title: isEpisode ? (s.grandparent_title ?? s.title ?? "Unknown") : (s.title ?? "Unknown"),
          subtitle,
          kind: s.media_type ?? "video",
          progress:
            duration && offset !== null && duration > 0
              ? Math.min(100, Math.max(0, (offset / duration) * 100))
              : num(s.progress_percent) ?? 0,
          state: String(s.state ?? "playing").toLowerCase(),
          transcoding: String(s.transcode_decision ?? "").toLowerCase() === "transcode",
          quality: s.quality_profile ?? s.video_full_resolution ?? "",
          player: s.player ?? "",
          thumb: s.grandparent_thumb || s.thumb || null,
          durationMs: duration,
          viewOffsetMs: offset,
        };
      }),
    };
  } catch (err) {
    return empty(true, err instanceof Error ? err.message : "unreachable");
  }
}

/**
 * Proxies Plex artwork through Tautulli's image endpoint so the browser never
 * needs the API key. Only Tautulli-style thumb paths are allowed through.
 */
export async function fetchArt(thumb: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!thumb.startsWith("/library/")) return null;
  const cfg = config();
  if (!cfg) return null;

  const params = new URLSearchParams({
    apikey: cfg.apiKey,
    cmd: "pms_image_proxy",
    img: thumb,
    width: "300",
    height: "450",
    fallback: "poster",
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${cfg.url}/api/v2?${params}`, { signal: controller.signal });
    if (!res.ok) return null;
    return {
      body: await res.arrayBuffer(),
      contentType: res.headers.get("content-type") ?? "image/jpeg",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function testConnection(url: string, apiKey: string) {
  try {
    const data = await call("get_server_friendly_name", {}, { url: url.replace(/\/+$/, ""), apiKey });
    return { ok: true, name: typeof data === "string" ? data : "Plex" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  }
}

let pollHandle: ReturnType<typeof setTimeout> | null = null;

export function startTautulliPolling(io: Server) {
  const tick = async () => {
    let interval = 60_000;
    try {
      const snapshot = await getActivity();
      io.emit("tautulli:update", snapshot);
      if (!snapshot.configured) interval = 60_000;
      else if (!snapshot.reachable) interval = 30_000;
      // Only worth polling quickly while something is actually playing.
      else interval = snapshot.streamCount > 0 ? 10_000 : 30_000;
    } catch {
      interval = 60_000;
    }
    pollHandle = setTimeout(tick, interval);
  };
  tick();
}

export function stopTautulliPolling() {
  if (pollHandle) clearTimeout(pollHandle);
}
