import { getSetting } from "../db.js";

export type ArrService = "sonarr" | "radarr";

export interface MediaItem {
  id: string;
  service: ArrService;
  kind: "movie" | "episode";
  /** Movie title, or series title for an episode. */
  title: string;
  /** "S02E05 · Trojan's Horse" for episodes; year for movies. */
  subtitle: string;
  /** Episode overview when available, else the movie/series overview. */
  overview: string;
  year: number | null;
  /** Path on our own API that proxies the cover art (keeps the API key server-side). */
  poster: string | null;
  addedAt: string;
  runtime: number | null;
  genres: string[];
  rating: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  /** Deep link into Sonarr/Radarr for the full details. */
  link: string | null;
  quality: string | null;
}

export interface MediaSnapshot {
  configured: boolean;
  items: MediaItem[];
  errors: { service: ArrService; message: string }[];
}

/**
 * Radarr/Sonarr history eventType for "downloaded and imported".
 *
 * The API binds this parameter as an integer enum — passing the string name
 * ("downloadFolderImported") is rejected with HTTP 400. Responses, confusingly,
 * serialise the same field *as* that string, which is what we match on when we
 * have to filter client-side.
 */
const EVENT_DOWNLOAD_IMPORTED_ID = "3";
const EVENT_DOWNLOAD_IMPORTED_NAME = "downloadFolderImported";

function config(service: ArrService): { url: string; apiKey: string } | null {
  const url = getSetting(`${service}_url`);
  const apiKey = getSetting(`${service}_api_key`);
  if (!url || !apiKey) return null;
  return { url: url.replace(/\/+$/, ""), apiKey };
}

async function callArr(
  service: ArrService,
  path: string,
  params: Record<string, string> = {}
): Promise<any> {
  const cfg = config(service);
  if (!cfg) throw new Error("not_configured");

  const qs = new URLSearchParams(params).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${cfg.url}${path}${qs ? `?${qs}` : ""}`, {
      headers: { "X-Api-Key": cfg.apiKey },
      signal: controller.signal,
    });
    if (res.status === 401) throw new Error("Invalid API key");
    if (!res.ok) throw new Error(`HTTP ${res.status}${await describeError(res)}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

/** Pulls the validation message out of an *arr error body, if there is one. */
async function describeError(res: Response): Promise<string> {
  try {
    const text = (await res.text()).slice(0, 300);
    if (!text) return "";
    try {
      const parsed = JSON.parse(text);
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const detail = first?.errorMessage ?? first?.message;
      if (detail) return ` — ${first.propertyName ? `${first.propertyName}: ` : ""}${detail}`;
    } catch {
      /* not JSON, fall through to the raw text */
    }
    return ` — ${text}`;
  } catch {
    return "";
  }
}

/**
 * Requests history filtered to imports. Older/newer *arr builds disagree about
 * the eventType parameter, so if the filtered call is rejected we retry
 * unfiltered and narrow the records ourselves.
 */
async function fetchImportHistory(
  service: ArrService,
  limit: number,
  extra: Record<string, string>
): Promise<any[]> {
  const base = {
    page: "1",
    pageSize: String(limit),
    sortKey: "date",
    sortDirection: "descending",
    ...extra,
  };

  let data: any;
  try {
    data = await callArr(service, "/api/v3/history", {
      ...base,
      eventType: EVENT_DOWNLOAD_IMPORTED_ID,
    });
  } catch (err) {
    if (!(err instanceof Error) || !err.message.startsWith("HTTP 400")) throw err;
    // Ask for more rows since we're about to discard the non-import events.
    data = await callArr(service, "/api/v3/history", {
      ...base,
      pageSize: String(limit * 5),
    });
  }

  const records: any[] = data?.records ?? [];
  return records.filter(
    (r) => !r?.eventType || r.eventType === EVENT_DOWNLOAD_IMPORTED_NAME
  );
}

function posterPath(service: ArrService, images: any[] | undefined): string | null {
  if (!Array.isArray(images)) return null;
  const poster = images.find((i) => i?.coverType === "poster") ?? images[0];
  // Prefer the *arr-local MediaCover path so we can proxy it with the API key;
  // remoteUrl would require the browser itself to reach TMDB/TheTVDB.
  const local: string | undefined = poster?.url;
  if (local && local.startsWith("/MediaCover/")) {
    return `/api/media/cover/${service}?path=${encodeURIComponent(local)}`;
  }
  return poster?.remoteUrl ?? null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

async function fetchRadarr(limit: number): Promise<MediaItem[]> {
  const records = await fetchImportHistory("radarr", limit, { includeMovie: "true" });

  const cfg = config("radarr");
  const seen = new Set<number>();
  const items: MediaItem[] = [];

  for (const record of records) {
    const movie = record.movie;
    if (!movie || seen.has(movie.id)) continue;
    seen.add(movie.id);

    items.push({
      id: `radarr-${record.id}`,
      service: "radarr",
      kind: "movie",
      title: movie.title ?? record.sourceTitle ?? "Unknown",
      subtitle: movie.year ? String(movie.year) : "",
      overview: movie.overview ?? "",
      year: movie.year ?? null,
      poster: posterPath("radarr", movie.images),
      addedAt: record.date ?? movie.added ?? new Date().toISOString(),
      runtime: movie.runtime ?? null,
      genres: movie.genres ?? [],
      rating: movie.ratings?.tmdb?.value ?? movie.ratings?.value ?? null,
      seasonNumber: null,
      episodeNumber: null,
      link: cfg && movie.titleSlug ? `${cfg.url}/movie/${movie.titleSlug}` : null,
      quality: record.quality?.quality?.name ?? null,
    });
  }
  return items;
}

async function fetchSonarr(limit: number): Promise<MediaItem[]> {
  const records = await fetchImportHistory("sonarr", limit, {
    includeSeries: "true",
    includeEpisode: "true",
  });

  const cfg = config("sonarr");
  const seen = new Set<string>();
  const items: MediaItem[] = [];

  for (const record of records) {
    const series = record.series;
    const episode = record.episode;
    if (!series || !episode) continue;

    const key = `${series.id}-${episode.seasonNumber}-${episode.episodeNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const code = `S${pad(episode.seasonNumber ?? 0)}E${pad(episode.episodeNumber ?? 0)}`;
    items.push({
      id: `sonarr-${record.id}`,
      service: "sonarr",
      kind: "episode",
      title: series.title ?? "Unknown",
      subtitle: episode.title ? `${code} · ${episode.title}` : code,
      // The episode's own synopsis is the interesting part; fall back to the series blurb.
      overview: episode.overview || series.overview || "",
      year: series.year ?? null,
      poster: posterPath("sonarr", series.images),
      addedAt: record.date ?? new Date().toISOString(),
      runtime: episode.runtime ?? series.runtime ?? null,
      genres: series.genres ?? [],
      rating: series.ratings?.value ?? null,
      seasonNumber: episode.seasonNumber ?? null,
      episodeNumber: episode.episodeNumber ?? null,
      link: cfg && series.titleSlug ? `${cfg.url}/series/${series.titleSlug}` : null,
      quality: record.quality?.quality?.name ?? null,
    });
  }
  return items;
}

let cache: { at: number; snapshot: MediaSnapshot } | null = null;
const CACHE_MS = 60_000;

export async function getRecentMedia(limit = 12, force = false): Promise<MediaSnapshot> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.snapshot;

  const hasSonarr = Boolean(config("sonarr"));
  const hasRadarr = Boolean(config("radarr"));

  if (!hasSonarr && !hasRadarr) {
    const snapshot: MediaSnapshot = { configured: false, items: [], errors: [] };
    cache = { at: Date.now(), snapshot };
    return snapshot;
  }

  const errors: { service: ArrService; message: string }[] = [];
  const results = await Promise.all([
    hasSonarr
      ? fetchSonarr(limit).catch((e) => {
          errors.push({ service: "sonarr", message: e?.message ?? "unreachable" });
          return [] as MediaItem[];
        })
      : Promise.resolve([] as MediaItem[]),
    hasRadarr
      ? fetchRadarr(limit).catch((e) => {
          errors.push({ service: "radarr", message: e?.message ?? "unreachable" });
          return [] as MediaItem[];
        })
      : Promise.resolve([] as MediaItem[]),
  ]);

  const items = results
    .flat()
    .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
    .slice(0, limit);

  const snapshot: MediaSnapshot = { configured: true, items, errors };
  cache = { at: Date.now(), snapshot };
  return snapshot;
}

export function invalidateMediaCache() {
  cache = null;
}

/**
 * Streams cover art from Sonarr/Radarr so the browser never needs the API key
 * (or internet access). Only MediaCover paths are proxied — anything else would
 * turn this into an open request forwarder.
 */
export async function fetchCover(
  service: ArrService,
  path: string
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  if (!path.startsWith("/MediaCover/")) return null;
  const cfg = config(service);
  if (!cfg) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${cfg.url}${path}`, {
      headers: { "X-Api-Key": cfg.apiKey },
      signal: controller.signal,
    });
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

export async function testArrConnection(service: ArrService, url: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/api/v3/system/status`, {
      headers: { "X-Api-Key": apiKey },
      signal: controller.signal,
    });
    if (res.status === 401) return { ok: false, error: "Invalid API key" };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, version: data?.version, name: data?.instanceName ?? service };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  } finally {
    clearTimeout(timeout);
  }
}
