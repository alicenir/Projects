import { stripAccents } from './taxonomy.js';

/**
 * Turning what is written on a bottle into something matchable. Labels are
 * abbreviated ("Ch. Margaux", "Cab Sauv"), decorated ("Grand Vin de Bordeaux")
 * and multilingual, and OCR adds its own noise on top. Everything here is about
 * getting two spellings of the same wine to collide.
 */

const ABBREVIATIONS: Record<string, string> = {
  ch: 'chateau', cht: 'chateau', chat: 'chateau', chateaux: 'chateau',
  dom: 'domaine', dne: 'domaine', doms: 'domaine',
  wgt: 'weingut', tenuta: 'tenuta', az: 'azienda',
  cab: 'cabernet', sauv: 'sauvignon', chard: 'chardonnay', pinot: 'pinot',
  zin: 'zinfandel', gsm: 'grenache syrah mourvedre', cs: 'cabernet sauvignon',
  ava: '', nv: '', mv: '',
  vyd: 'vineyard', vyds: 'vineyard', vnyd: 'vineyard', vineyards: 'vineyard',
  winery: 'winery', wines: 'wine', bodegas: 'bodega', vinos: 'vino',
  res: 'reserva', rsv: 'reserve', 'grand cru': 'grand cru',
};

/** Words that appear on half of all labels and carry no identity. */
const NOISE = new Set([
  'the', 'and', 'of', 'de', 'du', 'des', 'la', 'le', 'les', 'di', 'del', 'della', 'da', 'el',
  'wine', 'wines', 'vino', 'vin', 'vine', 'vineyard', 'vignoble', 'cellars', 'cellar',
  'product', 'produce', 'france', 'italia', 'espana', 'appellation', 'controlee', 'contro', 'aoc', 'doc',
  'docg', 'igt', 'ava', 'mis', 'bouteille', 'propriete', 'imported', 'import', 'alc', 'vol', 'ml', 'cl',
  'contains', 'sulfites', 'sulphites', 'bottled', 'estate', 'red', 'white', 'dry', 'brut', 'grand',
  'vin', 'wein', 'qualitatswein', 'trocken',
]);

export type Parsed = {
  raw: string;
  vintage: number | null;
  tokens: string[];
  /** Tokens minus the boilerplate — what actually identifies the bottle. */
  signal: string[];
};

export function normalize(text: string): string {
  return stripAccents(String(text ?? ''))
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pull a plausible vintage out of free text, ignoring ABV and volume numbers. */
export function extractVintage(text: string): number | null {
  const now = new Date().getFullYear();
  const matches = String(text ?? '').match(/\b(1[89]\d{2}|20\d{2})\b/g);
  if (!matches) return null;
  const years = matches.map(Number).filter((y) => y >= 1900 && y <= now + 1);
  if (!years.length) return null;
  // The most recent plausible year wins: labels print the vintage large and
  // any other year (an "established 1868") is older.
  return Math.max(...years);
}

export function parse(text: string, vintageHint?: number | null): Parsed {
  const raw = String(text ?? '').trim();
  const vintage = vintageHint ?? extractVintage(raw);
  const normalized = normalize(raw);
  const tokens: string[] = [];

  for (const token of normalized.split(' ')) {
    if (!token) continue;
    if (/^\d+$/.test(token)) continue;             // years, ABV, volumes
    const expanded = ABBREVIATIONS[token] ?? token;
    for (const part of expanded.split(' ')) {
      if (part.length >= 2) tokens.push(part);
    }
  }

  return { raw, vintage, tokens, signal: tokens.filter((t) => !NOISE.has(t)) };
}

/** Dice coefficient over token sets — forgiving about word order and extras. */
export function similarity(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const left = new Set(a);
  const right = new Set(b);
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return (2 * shared) / (left.size + right.size);
}

/** How much of the query the candidate accounts for (0–1). */
export function coverage(query: string[], candidate: string[]): number {
  if (!query.length) return 0;
  const bag = new Set(candidate);
  let hit = 0;
  for (const token of new Set(query)) if (bag.has(token)) hit++;
  return hit / new Set(query).size;
}

/**
 * Levenshtein close enough for one OCR slip per word ("chatoau" → "chateau").
 * Bounded so a long pair bails out early.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < best) best = row[j];
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

/** Token overlap that tolerates one typo per word, for OCR'd text. */
export function fuzzyCoverage(query: string[], candidate: string[]): number {
  if (!query.length) return 0;
  const unique = [...new Set(query)];
  let hit = 0;
  for (const token of unique) {
    if (candidate.includes(token)) {
      hit += 1;
      continue;
    }
    const near = candidate.some((c) => Math.abs(c.length - token.length) <= 2 && editDistance(c, token, token.length > 6 ? 2 : 1) <= (token.length > 6 ? 2 : 1));
    if (near) hit += 0.75;
  }
  return hit / unique.length;
}

/** Build the searchable token bag stored in lookup_index. */
export function termsFor(parts: (string | null | undefined)[]): string {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of parse(String(part)).tokens) tokens.add(token);
  }
  return [...tokens].join(' ');
}

/** An FTS5 OR query: any identifying token is enough to surface a candidate. */
export function ftsAnyQuery(tokens: string[]): string | null {
  const useful = [...new Set(tokens)].filter((t) => t.length > 2).slice(0, 12);
  if (!useful.length) return null;
  return useful.map((t) => `"${t}"*`).join(' OR ');
}
