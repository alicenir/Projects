import type { Database as Db } from 'better-sqlite3';

export type WineFilters = {
  q?: string;
  type?: string[];
  country?: string[];
  region?: number[];
  winery?: number[];
  grape?: string[];
  pairing?: string[];
  body?: string[];
  acidity?: string[];
  abvMin?: number;
  abvMax?: number;
  vintage?: number;
  minRatings?: number;
  maxRatings?: number;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export type WineCard = {
  id: number; name: string; type: string; elaborate: string; winery: string; winery_id: number | null;
  region: string; region_id: number | null; country: string; country_code: string;
  abv: number | null; body: string; acidity: string; grapes: string[]; pairings: string[];
  rating_avg: number | null; rating_count: number; rating_score: number | null;
  vintage_min: number | null; vintage_max: number | null; vintage_count: number; non_vintage: number;
};

const SORTS: Record<string, string> = {
  score: 'w.rating_score DESC NULLS LAST, w.rating_count DESC',
  rating: 'w.rating_avg DESC NULLS LAST, w.rating_count DESC',
  popular: 'w.rating_count DESC, w.rating_score DESC',
  name: 'w.name COLLATE NOCASE ASC',
  winery: 'w.winery COLLATE NOCASE ASC, w.name COLLATE NOCASE ASC',
  abv_desc: 'w.abv DESC NULLS LAST',
  abv_asc: 'w.abv ASC NULLS LAST',
  oldest: 'w.vintage_min ASC NULLS LAST',
  random: 'RANDOM()',
};

/**
 * Turn what someone typed into an FTS5 prefix query: every token must match,
 * and the last one matches as a prefix so results narrow as you type.
 */
export function ftsQuery(raw: string): string | null {
  const tokens = String(raw || '')
    .replace(/["*()]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t}"*`).join(' AND ');
}

function inClause(column: string, values: string[] | number[], params: unknown[]): string {
  params.push(...values);
  return `${column} IN (${values.map(() => '?').join(', ')})`;
}

export function buildWhere(f: WineFilters): { sql: string; params: unknown[] } {
  const clauses: string[] = [];
  const params: unknown[] = [];

  const fts = f.q ? ftsQuery(f.q) : null;
  if (fts) {
    clauses.push('w.id IN (SELECT rowid FROM wines_fts WHERE wines_fts MATCH ?)');
    params.push(fts);
  }
  if (f.type?.length) clauses.push(inClause('w.type', f.type, params));
  if (f.country?.length) clauses.push(inClause('w.country_code', f.country, params));
  if (f.region?.length) clauses.push(inClause('w.region_id', f.region, params));
  if (f.winery?.length) clauses.push(inClause('w.winery_id', f.winery, params));
  if (f.body?.length) clauses.push(inClause('w.body', f.body, params));
  if (f.acidity?.length) clauses.push(inClause('w.acidity', f.acidity, params));
  if (f.grape?.length) {
    clauses.push(`EXISTS (SELECT 1 FROM wine_grapes g WHERE g.wine_id = w.id AND ${inClause('g.grape', f.grape, params)})`);
  }
  if (f.pairing?.length) {
    clauses.push(`EXISTS (SELECT 1 FROM wine_pairings p WHERE p.wine_id = w.id AND ${inClause('p.pairing', f.pairing, params)})`);
  }
  if (f.abvMin !== undefined) {
    clauses.push('w.abv >= ?');
    params.push(f.abvMin);
  }
  if (f.abvMax !== undefined) {
    clauses.push('w.abv <= ?');
    params.push(f.abvMax);
  }
  if (f.vintage !== undefined) {
    clauses.push('EXISTS (SELECT 1 FROM wine_vintages v WHERE v.wine_id = w.id AND v.vintage = ?)');
    params.push(f.vintage);
  }
  if (f.minRatings) {
    clauses.push('w.rating_count >= ?');
    params.push(f.minRatings);
  }
  if (f.maxRatings) {
    clauses.push('w.rating_count <= ?');
    params.push(f.maxRatings);
  }

  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export function hydrate(row: Record<string, unknown>): WineCard {
  return {
    ...(row as unknown as WineCard),
    grapes: JSON.parse(String(row.grapes ?? '[]')),
    pairings: JSON.parse(String(row.pairings ?? '[]')),
  };
}

export const CARD_COLUMNS = `
  w.id, w.name, w.type, w.elaborate, w.winery, w.winery_id, w.region, w.region_id,
  w.country, w.country_code, w.abv, w.body, w.acidity, w.grapes, w.pairings,
  w.rating_avg, w.rating_count, w.rating_score, w.vintage_min, w.vintage_max,
  w.vintage_count, w.non_vintage`;

export type WineQueryResult = {
  total: number;
  page: number;
  pageSize: number;
  items: WineCard[];
  facets?: Record<string, { value: string; label?: string; count: number }[]>;
};

export function queryWines(db: Db, f: WineFilters, opts: { facets?: boolean } = {}): WineQueryResult {
  const { sql: where, params } = buildWhere(f);
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 24));
  const order = SORTS[f.sort ?? 'score'] ?? SORTS.score;

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM wines w ${where}`).get(...params) as { n: number }).n;
  const rows = db
    .prepare(`SELECT ${CARD_COLUMNS} FROM wines w ${where} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize) as Record<string, unknown>[];

  const result: WineQueryResult = { total, page, pageSize, items: rows.map(hydrate) };
  if (opts.facets) result.facets = facetsFor(db, where, params);
  return result;
}

/** Facet counts under the filters currently applied, for the drill-down sidebar. */
function facetsFor(db: Db, where: string, params: unknown[]): WineQueryResult['facets'] {
  const simple = (column: string, limit = 60) =>
    db
      .prepare(`SELECT ${column} AS value, COUNT(*) AS count FROM wines w ${where} GROUP BY value HAVING value <> '' ORDER BY count DESC LIMIT ${limit}`)
      .all(...params) as { value: string; count: number }[];

  const joined = (table: string, column: string, limit = 40) =>
    db
      .prepare(`
        SELECT j.${column} AS value, COUNT(*) AS count
        FROM wines w JOIN ${table} j ON j.wine_id = w.id
        ${where}
        GROUP BY value ORDER BY count DESC LIMIT ${limit}`)
      .all(...params) as { value: string; count: number }[];

  const countries = db
    .prepare(`
      SELECT w.country_code AS value, w.country AS label, COUNT(*) AS count
      FROM wines w ${where}
      GROUP BY value, label ORDER BY count DESC LIMIT 60`)
    .all(...params) as { value: string; label: string; count: number }[];

  return {
    type: simple('w.type', 10),
    body: simple('w.body', 10),
    acidity: simple('w.acidity', 5),
    country: countries,
    grape: joined('wine_grapes', 'grape'),
    pairing: joined('wine_pairings', 'pairing'),
  };
}
