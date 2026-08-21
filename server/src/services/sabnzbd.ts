import type { Server } from "socket.io";
import { getSetting } from "../db.js";

export interface SabnzbdSlot {
  nzo_id: string;
  filename: string;
  status: string;
  percentage: number;
  mb: number;
  mbleft: number;
  timeleft: string;
  size: string;
  sizeleft: string;
  priority: string;
  cat: string;
}

export interface SabnzbdHistorySlot {
  nzo_id: string;
  name: string;
  status: string;
  size: string;
  completed: number;
  fail_message: string;
}

export interface SabnzbdSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;
  paused: boolean;
  speed: string;
  speedBps: number;
  kbpersec: string;
  timeleft: string;
  sizeleft: string;
  diskspace: string;
  queue: SabnzbdSlot[];
  history: SabnzbdHistorySlot[];
}

function getConfig(): { url: string; apiKey: string } | null {
  const url = getSetting("sabnzbd_url");
  const apiKey = getSetting("sabnzbd_api_key");
  if (!url || !apiKey) return null;
  return { url: url.replace(/\/+$/, ""), apiKey };
}

async function callApi(mode: string, extra: Record<string, string> = {}) {
  const config = getConfig();
  if (!config) throw new Error("not_configured");

  const params = new URLSearchParams({
    mode,
    output: "json",
    apikey: config.apiKey,
    ...extra,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${config.url}/api?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSnapshot(): Promise<SabnzbdSnapshot> {
  const config = getConfig();
  if (!config) {
    return {
      configured: false,
      reachable: false,
      paused: false,
      speed: "0 B/s",
      speedBps: 0,
      kbpersec: "0",
      timeleft: "",
      sizeleft: "0 B",
      diskspace: "",
      queue: [],
      history: [],
    };
  }

  try {
    const [queueRes, historyRes] = await Promise.all([
      callApi("queue"),
      callApi("history", { limit: "10" }),
    ]);

    const q = queueRes.queue ?? {};
    const kbpersec = parseFloat(q.kbpersec ?? "0");

    return {
      configured: true,
      reachable: true,
      paused: Boolean(q.paused),
      speed: q.speed ?? "0 B/s",
      speedBps: kbpersec * 1024,
      kbpersec: q.kbpersec ?? "0",
      timeleft: q.timeleft ?? "",
      sizeleft: q.sizeleft ?? "0 B",
      diskspace: q.diskspacetotal1 ? `${q.diskspace1} / ${q.diskspacetotal1} GB free` : "",
      queue: (q.slots ?? []).map((s: any) => ({
        nzo_id: s.nzo_id,
        filename: s.filename,
        status: s.status,
        percentage: parseFloat(s.percentage ?? "0"),
        mb: parseFloat(s.mb ?? "0"),
        mbleft: parseFloat(s.mbleft ?? "0"),
        timeleft: s.timeleft ?? "",
        size: s.size ?? "",
        sizeleft: s.sizeleft ?? "",
        priority: s.priority ?? "Normal",
        cat: s.cat ?? "",
      })),
      history: (historyRes.history?.slots ?? []).map((s: any) => ({
        nzo_id: s.nzo_id,
        name: s.name,
        status: s.status,
        size: s.size ?? "",
        completed: s.completed ?? 0,
        fail_message: s.fail_message ?? "",
      })),
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      error: err instanceof Error ? err.message : "unknown_error",
      paused: false,
      speed: "0 B/s",
      speedBps: 0,
      kbpersec: "0",
      timeleft: "",
      sizeleft: "0 B",
      diskspace: "",
      queue: [],
      history: [],
    };
  }
}

export async function pauseQueue() {
  return callApi("pause");
}

export async function resumeQueue() {
  return callApi("resume");
}

export async function deleteJob(nzoId: string) {
  return callApi("queue", { name: "delete", value: nzoId });
}

export async function pauseJob(nzoId: string) {
  return callApi("queue", { name: "pause", value: nzoId });
}

export async function resumeJob(nzoId: string) {
  return callApi("queue", { name: "resume", value: nzoId });
}

export async function testConnection(url: string, apiKey: string) {
  const params = new URLSearchParams({ mode: "version", output: "json", apikey: apiKey });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/api?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    if (data.error) return { ok: false, error: data.error };
    return { ok: true, version: data.version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}

let pollHandle: ReturnType<typeof setTimeout> | null = null;

export function startSabnzbdPolling(io: Server) {
  const tick = async () => {
    try {
      const snapshot = await getSnapshot();
      io.emit("sabnzbd:update", snapshot);
      // Poll faster while there's active queue activity, slower when idle/unconfigured.
      const interval = snapshot.configured && snapshot.queue.length > 0 ? 2000 : 8000;
      pollHandle = setTimeout(tick, interval);
    } catch {
      pollHandle = setTimeout(tick, 8000);
    }
  };
  tick();
}

export function stopSabnzbdPolling() {
  if (pollHandle) clearTimeout(pollHandle);
}
