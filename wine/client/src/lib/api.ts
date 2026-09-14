import { useEffect, useRef, useState } from 'react';

export type WineCard = {
  id: number;
  name: string;
  type: string;
  elaborate: string;
  winery: string;
  winery_id: number | null;
  region: string;
  region_id: number | null;
  country: string;
  country_code: string;
  abv: number | null;
  body: string;
  acidity: string;
  grapes: string[];
  pairings: string[];
  rating_avg: number | null;
  rating_count: number;
  rating_score: number | null;
  vintage_min: number | null;
  vintage_max: number | null;
  vintage_count: number;
  non_vintage: number;
  match?: number;
  reasons?: string[];
};

export type Facets = Record<string, { value: string; label?: string; count: number }[]>;

export type WineList = { total: number; page: number; pageSize: number; items: WineCard[]; facets?: Facets };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export type ApiState<T> = { data: T | null; error: string | null; loading: boolean; refetching: boolean };

/**
 * Small fetch hook. On a re-fetch it keeps the previous data on screen (the
 * caller dims it) rather than flashing a skeleton and jumping the layout.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []): ApiState<T> & { reload: () => void } {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true, refetching: false });
  const [nonce, setNonce] = useState(0);
  const seen = useRef(false);

  useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false, refetching: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: !seen.current, refetching: seen.current, error: null }));
    api<T>(path)
      .then((data) => {
        if (cancelled) return;
        seen.current = true;
        setState({ data, error: null, loading: false, refetching: false });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState((s) => ({ ...s, error: err.message, loading: false, refetching: false }));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

export function queryString(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (!value.length) continue;
      q.set(key, value.join(','));
    } else q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
