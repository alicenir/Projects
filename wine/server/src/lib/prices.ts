import type { Database as Db } from 'better-sqlite3';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '../db.js';
import type { Match } from './resolve.js';

/**
 * Live prices.
 *
 * Wine pricing is a licensed business: Wine-Searcher, Liv-ex and the rest sell
 * trade API keys, and the state monopolies (Vinmonopolet, Systembolaget, Alko)
 * publish their own catalogues as open data behind a free key. Rather than
 * hard-code one of them, this is a mapped HTTP adapter: describe any JSON
 * catalogue API in a config file — its URL, headers and where the fields live —
 * and prices flow into the bottle dossier with the time they were fetched.
 *
 * Whatever the source, the critic corpus is always available underneath as a
 * price *benchmark*: what this grape and region usually cost, clearly labelled
 * as a 2017 reference rather than a live quote.
 */

export type Quote = {
  merchant: string | null;
  name: string | null;
  price: number | null;
  currency: string | null;
  url: string | null;
  inStock: boolean | null;
  vintage: number | null;
};

export type ProviderConfig = {
  name: string;
  url: string;                                  // {query} and {vintage} are substituted
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;             // ${ENV_VAR} is substituted from the environment
  body?: unknown;
  resultsPath?: string;                         // dotted path to the array of results
  fields?: Record<string, string>;              // dotted paths, or "=literal" for a fixed value
  currency?: string;
  ttlMinutes?: number;
  timeoutMs?: number;
};

const CONFIG_PATH = process.env.PRICE_PROVIDER_CONFIG || path.join(DATA_DIR, 'price-provider.json');

let cached: { at: number; mtime: number; config: ProviderConfig | null } | null = null;

export async function loadProvider(): Promise<ProviderConfig | null> {
  try {
    const info = await stat(CONFIG_PATH);
    if (cached && cached.mtime === info.mtimeMs) return cached.config;
    const raw = await readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw) as ProviderConfig;
    if (!config.url || !/^https?:\/\//i.test(config.url)) throw new Error('price provider needs an http(s) url');
    cached = { at: Date.now(), mtime: info.mtimeMs, config };
    return config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      cached = { at: Date.now(), mtime: 0, config: null };
      return null;
    }
    throw err;
  }
}

function pick(source: unknown, dotted: string): unknown {
  if (dotted.startsWith('=')) return dotted.slice(1);
  let value: unknown = source;
  for (const part of dotted.split('.')) {
    if (value === null || value === undefined) return null;
    value = Array.isArray(value) ? (value as unknown[])[Number(part)] : (value as Record<string, unknown>)[part];
  }
  return value ?? null;
}

function expandEnv(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => process.env[name] ?? '');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[^0-9.,]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Call the configured provider. Returns [] when none is configured. */
export async function fetchQuotes(query: string, vintage: number | null): Promise<{ provider: string; quotes: Quote[] } | null> {
  const config = await loadProvider();
  if (!config) return null;

  const url = config.url
    .replace(/\{query\}/g, encodeURIComponent(query))
    .replace(/\{vintage\}/g, vintage ? String(vintage) : '');

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(config.headers ?? {})) headers[key] = expandEnv(value);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 8000);
  try {
    const res = await fetch(url, {
      method: config.method ?? 'GET',
      headers,
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${config.name}: ${res.status} ${res.statusText}`);
    const payload = (await res.json()) as unknown;
    const rows = (config.resultsPath ? pick(payload, config.resultsPath) : payload) as unknown;
    const list = Array.isArray(rows) ? rows : [];
    const fields = config.fields ?? {};

    const quotes: Quote[] = list.slice(0, 12).map((row) => ({
      merchant: fields.merchant ? String(pick(row, fields.merchant) ?? '') || config.name : config.name,
      name: fields.name ? (pick(row, fields.name) as string | null) : null,
      price: fields.price ? toNumber(pick(row, fields.price)) : null,
      currency: (fields.currency ? (pick(row, fields.currency) as string | null) : null) ?? config.currency ?? null,
      url: fields.url ? (pick(row, fields.url) as string | null) : null,
      inStock: fields.inStock ? Boolean(pick(row, fields.inStock)) : null,
      vintage: fields.vintage ? toNumber(pick(row, fields.vintage)) : vintage,
    }));
    return { provider: config.name, quotes };
  } finally {
    clearTimeout(timer);
  }
}

export function cacheQuotes(db: Db, provider: string, query: string, vintage: number | null, match: Match | null, quotes: Quote[]): void {
  const insert = db.prepare(`INSERT INTO cellar.price_quotes
    (provider, query, vintage, wine_id, label_id, name, merchant, price, currency, url, in_stock)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    for (const q of quotes) {
      insert.run(
        provider, query, vintage,
        match && match.kind === 'wine' ? match.ref : null,
        match && match.kind === 'label' ? match.ref : null,
        q.name, q.merchant, q.price, q.currency, q.url, q.inStock === null ? null : q.inStock ? 1 : 0,
      );
    }
  })();
}

export type PriceReport = {
  live: { provider: string; fetchedAt: string; quotes: Quote[] } | null;
  benchmark: { scope: string; n: number; points_avg: number; price_med: number; price_p10: number; price_p90: number } | null;
  benchmarkNote: string;
  providerConfigured: boolean;
};

/**
 * What we can say about price without going to the network: the newest cached
 * quotes, plus the critic benchmark for this grape and country.
 */
export function quotesFor(db: Db, input: { text: string; vintage: number | null; match: Match | null }): PriceReport {
  const rows = db
    .prepare(`SELECT provider, name, merchant, price, currency, url, in_stock, vintage, fetched_at
              FROM cellar.price_quotes
              WHERE query = ? AND (vintage IS ? OR vintage = ?)
              ORDER BY fetched_at DESC LIMIT 12`)
    .all(input.text, input.vintage, input.vintage) as Record<string, unknown>[];

  const live = rows.length
    ? {
        provider: String(rows[0].provider),
        fetchedAt: String(rows[0].fetched_at),
        quotes: rows.map((r) => ({
          merchant: r.merchant as string | null,
          name: r.name as string | null,
          price: r.price as number | null,
          currency: r.currency as string | null,
          url: r.url as string | null,
          inStock: r.in_stock === null ? null : Boolean(r.in_stock),
          vintage: r.vintage as number | null,
        })),
      }
    : null;

  let benchmark: PriceReport['benchmark'] = null;
  if (input.match) {
    const key =
      input.match.kind === 'wine'
        ? (db.prepare(`SELECT grape_key(json_extract(grapes, '$[0]')) AS k FROM wines WHERE id = ?`).get(input.match.ref) as { k: string | null })?.k
        : (db.prepare('SELECT grape_key FROM critic_labels WHERE id = ?').get(input.match.ref) as { grape_key: string | null })?.grape_key;
    if (key) {
      benchmark = (db.prepare("SELECT 'grape' AS scope, n, points_avg, price_med, price_p10, price_p90 FROM critic_stats WHERE scope = 'grape' AND key = ?")
        .get(key) as PriceReport['benchmark']) ?? null;
    }
  }

  return {
    live,
    benchmark,
    benchmarkNote: 'Benchmark prices are Wine Enthusiast list prices collected in 2017, in US dollars — a reference point, not a live quote.',
    providerConfigured: cached ? cached.config !== null : false,
  };
}
