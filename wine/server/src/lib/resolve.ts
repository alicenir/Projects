import type { Database as Db } from 'better-sqlite3';
import { CARD_COLUMNS, hydrate } from './wineQuery.js';
import { extractDescriptors, grapeKey } from './taxonomy.js';
import { coverage, ftsAnyQuery, fuzzyCoverage, parse, similarity } from './identity.js';
import type { Parsed } from './identity.js';

export type Match = {
  kind: 'wine' | 'label';
  ref: number;
  confidence: number;
  why: string[];
  title: string;
  subtitle: string;
  vintage: number | null;
};

type IndexRow = { id: number; kind: 'wine' | 'label'; ref: number; winery: string | null; name: string | null; terms: string; weight: number };

const CANDIDATE_LIMIT = 500;

/**
 * Work out which bottle somebody is holding. The text can come from a form or
 * from OCR of a label, so scoring rewards explaining the query rather than
 * matching it exactly, and tolerates a typo per word.
 */
export function identify(db: Db, text: string, vintageHint?: number | null, limit = 6): { parsed: Parsed; matches: Match[] } {
  const parsed = parse(text, vintageHint);
  const query = parsed.signal.length ? parsed.signal : parsed.tokens;
  const match = ftsAnyQuery(query);
  if (!match) return { parsed, matches: [] };

  const rows = db
    .prepare(`SELECT li.id, li.kind, li.ref, li.winery, li.name, li.terms, li.weight
              FROM lookup_fts f JOIN lookup_index li ON li.id = f.rowid
              WHERE lookup_fts MATCH ?
              ORDER BY bm25(lookup_fts) LIMIT ?`)
    .all(match, CANDIDATE_LIMIT) as IndexRow[];

  const scored = rows.map((row) => score(db, row, parsed, query));
  scored.sort((a, b) => b.confidence - a.confidence);

  // One bottle should not appear twice because both datasets know it.
  const seen = new Set<string>();
  const matches: Match[] = [];
  for (const m of scored) {
    const key = `${(m.title || '').toLowerCase()}|${(m.subtitle || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push(m);
    if (matches.length >= limit) break;
  }
  return { parsed, matches };
}

function score(db: Db, row: IndexRow, parsed: Parsed, query: string[]): Match {
  const candidate = row.terms.split(' ');
  const why: string[] = [];

  const cov = fuzzyCoverage(query, candidate);
  const sim = similarity(query, candidate);
  const base = 0.62 * cov + 0.38 * sim;

  // Bonuses eat into the headroom that is left rather than piling past 100%,
  // so three good matches still rank against each other instead of all pegging.
  let boost = 0;
  let penalty = 0;

  const wineryTokens = parse(row.winery ?? '').signal;
  if (wineryTokens.length && coverage(wineryTokens, query) >= 0.6) {
    boost += 0.35;
    why.push(`producer matches ${row.winery}`);
  }
  boost += Math.min(0.2, (row.weight - 1) * 0.9);

  let vintage: number | null = parsed.vintage;
  if (parsed.vintage) {
    const covered = hasVintage(db, row, parsed.vintage);
    if (covered === true) {
      boost += 0.3;
      why.push(`${parsed.vintage} is covered`);
    } else if (covered === false) {
      penalty += 0.08;
      why.push(`no data for ${parsed.vintage}`);
      vintage = parsed.vintage;
    }
  }

  const value = base + (1 - base) * Math.min(0.85, boost) - penalty;

  if (cov >= 0.95 && sim >= 0.7) why.unshift('every word matches');
  else if (cov >= 0.7) why.unshift('most of the label matches');

  const meta = describe(db, row);
  return {
    kind: row.kind,
    ref: row.ref,
    confidence: Math.max(1, Math.min(99, Math.round(value * 100))),
    why: why.slice(0, 3),
    title: meta.title,
    subtitle: meta.subtitle,
    vintage,
  };
}

function hasVintage(db: Db, row: IndexRow, vintage: number): boolean | null {
  if (row.kind === 'wine') {
    const hit = db.prepare('SELECT 1 AS x FROM wine_vintages WHERE wine_id = ? AND vintage = ?').get(row.ref, vintage);
    if (hit) return true;
    const any = db.prepare('SELECT 1 AS x FROM wine_vintages WHERE wine_id = ? LIMIT 1').get(row.ref);
    return any ? false : null;
  }
  const hit = db.prepare('SELECT 1 AS x FROM critic_label_vintages WHERE label_id = ? AND vintage = ?').get(row.ref, vintage);
  if (hit) return true;
  const any = db.prepare('SELECT 1 AS x FROM critic_label_vintages WHERE label_id = ? LIMIT 1').get(row.ref);
  return any ? false : null;
}

function describe(db: Db, row: IndexRow): { title: string; subtitle: string } {
  if (row.kind === 'wine') {
    const w = db.prepare('SELECT name, winery, region, country, type FROM wines WHERE id = ?').get(row.ref) as
      { name: string; winery: string; region: string; country: string; type: string } | undefined;
    if (!w) return { title: row.name ?? '', subtitle: row.winery ?? '' };
    return { title: `${w.winery} ${w.name}`.trim(), subtitle: [w.type, w.region, w.country].filter(Boolean).join(' · ') };
  }
  const l = db.prepare('SELECT winery, designation, variety, region, province, country FROM critic_labels WHERE id = ?').get(row.ref) as
    { winery: string; designation: string | null; variety: string | null; region: string | null; province: string | null; country: string | null } | undefined;
  if (!l) return { title: row.name ?? '', subtitle: row.winery ?? '' };
  return {
    title: [l.winery, l.designation, l.variety].filter(Boolean).join(' ').trim(),
    subtitle: [l.region ?? l.province, l.country].filter(Boolean).join(' · '),
  };
}

/* ------------------------------------------------------------------ dossier */

/** Everything the site knows about one identified bottle. */
export function dossier(db: Db, kind: 'wine' | 'label', ref: number, vintage: number | null) {
  return kind === 'wine' ? wineDossier(db, ref, vintage) : labelDossier(db, ref, vintage);
}

function flavoursFor(db: Db, key: string | null) {
  if (!key) return [];
  return db
    .prepare(`SELECT word, family, n, share, lift FROM descriptors WHERE scope = 'grape' AND key = ?
              ORDER BY lift DESC LIMIT 12`)
    .all(key) as Record<string, unknown>[];
}

function benchmarkFor(db: Db, key: string | null, countryCode: string | null) {
  if (!key) return { grape: null, here: null };
  return {
    grape: db.prepare("SELECT * FROM critic_stats WHERE scope = 'grape' AND key = ?").get(key) ?? null,
    here: countryCode
      ? db.prepare("SELECT * FROM critic_stats WHERE scope = 'grape_country' AND key = ?").get(`${key}~${countryCode}`) ?? null
      : null,
  };
}

function wineDossier(db: Db, id: number, vintage: number | null) {
  const row = db.prepare(`SELECT ${CARD_COLUMNS}, w.vintages, w.website FROM wines w WHERE w.id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const wine = { ...hydrate(row), vintages: JSON.parse(String(row.vintages ?? '[]')) as number[], website: row.website as string | null };
  const key = wine.grapes[0] ? grapeKey(wine.grapes[0]) : null;

  const thisVintage = vintage
    ? (db
        .prepare(`SELECT COUNT(*) AS n, AVG(rating) AS avg FROM ratings WHERE wine_id = ? AND vintage = ?`)
        .get(id, vintage) as { n: number; avg: number | null })
    : null;

  return {
    kind: 'wine' as const,
    wineId: id,
    identity: {
      producer: wine.winery,
      name: wine.name,
      vintage,
      region: wine.region,
      country: wine.country,
      countryCode: wine.country_code,
      grapes: wine.grapes,
      type: wine.type,
      abv: wine.abv,
      body: wine.body,
      acidity: wine.acidity,
      vintages: wine.vintages,
    },
    community: {
      average: wine.rating_avg,
      count: wine.rating_count,
      weighted: wine.rating_score,
      histogram: db.prepare('SELECT bucket, n FROM wine_rating_hist WHERE wine_id = ? ORDER BY bucket').all(id),
      byVintage: db
        .prepare(`SELECT vintage, COUNT(*) AS n, AVG(rating) AS avg FROM ratings
                  WHERE wine_id = ? AND vintage IS NOT NULL GROUP BY vintage HAVING n >= 3 ORDER BY vintage DESC LIMIT 14`)
        .all(id),
      thisVintage: thisVintage && thisVintage.n ? thisVintage : null,
    },
    pairings: wine.pairings,
    flavours: flavoursFor(db, key),
    benchmark: benchmarkFor(db, key, wine.country_code),
    criticLabels: db
      .prepare(`SELECT id, winery, designation, variety, region, n, points_avg, points_max, price_med, vintage_min, vintage_max
                FROM critic_labels WHERE lower(winery) = lower(?) ORDER BY points_avg DESC LIMIT 4`)
      .all(wine.winery),
    similar: db
      .prepare(`SELECT ${CARD_COLUMNS} FROM wine_similar s JOIN wines w ON w.id = s.other_id
                WHERE s.wine_id = ? AND s.kind = 'taste' ORDER BY s.score DESC LIMIT 4`)
      .all(id)
      .map((r) => hydrate(r as Record<string, unknown>)),
  };
}

function labelDossier(db: Db, id: number, vintage: number | null) {
  const label = db.prepare('SELECT * FROM critic_labels WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!label) return null;

  // One row per vintage: a label can carry several reviews of the same year
  // (different bottlings, re-tastes), and the best-scored one represents it.
  const vintages = db
    .prepare(`SELECT v.vintage, MAX(v.points) AS points, v.price, v.review_id
              FROM critic_label_vintages v WHERE v.label_id = ?
              GROUP BY v.vintage ORDER BY v.vintage DESC`)
    .all(id) as { vintage: number; points: number | null; price: number | null; review_id: number }[];

  const wanted = vintage ? vintages.find((v) => v.vintage === vintage) : null;
  const nearest = !wanted && vintage && vintages.length
    ? vintages.reduce((best, v) => (Math.abs(v.vintage - vintage) < Math.abs(best.vintage - vintage) ? v : best), vintages[0])
    : null;
  const chosen = wanted ?? nearest ?? vintages[0] ?? null;

  const review = chosen
    ? (db
        .prepare('SELECT id, title, vintage, points, price, description, taster, variety, region, country FROM critic_reviews WHERE id = ?')
        .get(chosen.review_id) as Record<string, unknown> | undefined)
    : undefined;

  const key = (label.grape_key as string | null) ?? null;
  const countryCode = db.prepare('SELECT country_code(?) AS code').get(label.country) as { code: string | null };

  // Descriptors the critics actually used on this label, not just its grape.
  const ownNotes = db
    .prepare(`SELECT c.description FROM critic_label_vintages v JOIN critic_reviews c ON c.id = v.review_id
              WHERE v.label_id = ? LIMIT 12`)
    .all(id) as { description: string }[];
  const ownCounts = new Map<string, { n: number; family: string }>();
  for (const note of ownNotes) {
    for (const term of extractDescriptors(note.description ?? '')) {
      const cur = ownCounts.get(term.term);
      if (cur) cur.n++;
      else ownCounts.set(term.term, { n: 1, family: term.family });
    }
  }
  const ownDescriptors = [...ownCounts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .map(([word, info]) => ({ word, family: info.family, n: info.n }));

  return {
    kind: 'label' as const,
    labelId: id,
    identity: {
      producer: label.winery as string,
      name: (label.designation as string | null) ?? (label.variety as string | null),
      vintage: chosen ? chosen.vintage : vintage,
      requestedVintage: vintage,
      exactVintage: Boolean(wanted),
      region: (label.region as string | null) ?? (label.province as string | null),
      country: label.country as string | null,
      countryCode: countryCode?.code ?? null,
      grapes: label.variety ? [label.variety as string] : [],
      vintages: vintages.map((v) => v.vintage),
    },
    critics: {
      reviews: label.n as number,
      pointsAverage: label.points_avg as number | null,
      pointsBest: label.points_max as number | null,
      priceMedian: label.price_med as number | null,
      priceRange: [label.price_min as number | null, label.price_max as number | null],
      vintages,
      review: review ?? null,
    },
    flavours: flavoursFor(db, key),
    ownDescriptors,
    benchmark: benchmarkFor(db, key, countryCode?.code ?? null),
    catalogue: db
      .prepare(`SELECT ${CARD_COLUMNS} FROM wines w
                WHERE lower(w.winery) = lower(?)
                   OR (w.country = ? AND EXISTS (SELECT 1 FROM wine_grapes g WHERE g.wine_id = w.id AND grape_key(g.grape) = ?))
                ORDER BY w.rating_score DESC NULLS LAST LIMIT 4`)
      .all(label.winery, label.country, key)
      .map((r) => hydrate(r as Record<string, unknown>)),
  };
}
