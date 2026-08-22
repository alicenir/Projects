import { Agent } from "undici";

/**
 * Homelab services are routinely exposed over HTTPS with a self-signed
 * certificate (Portainer's default cert being the most common case) — these
 * are URLs the user typed into their own dashboard, not third-party
 * endpoints, so we trust them the same way health.ts already does for its
 * reachability probe. Scoped to a dedicated dispatcher rather than the
 * NODE_TLS_REJECT_UNAUTHORIZED env var so it can never leak into unrelated
 * concurrent requests (e.g. the Open-Meteo calls, which should stay
 * strictly verified since they leave the LAN).
 */
const insecureAgent = new Agent({ connect: { rejectUnauthorized: false } });

export function lanFetch(url: string, init: RequestInit = {}): Promise<Response> {
  if (!url.startsWith("https://")) return fetch(url, init);
  // `dispatcher` is a real, supported option on Node's undici-backed fetch,
  // it's just missing from lib.dom.d.ts's RequestInit — hence the cast.
  return fetch(url, { ...init, dispatcher: insecureAgent } as RequestInit);
}
