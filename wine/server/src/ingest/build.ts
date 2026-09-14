import Database from 'better-sqlite3';
import type { Database as Db } from 'better-sqlite3';
import { rm, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { readCsvObjects, parsePyList, num } from './csv.js';
import { CATALOGUE_SCHEMA } from './schema.js';
import { extractDescriptors, grapeKey, countryCode, vintageFromTitle } from '../lib/taxonomy.js';

export type BuildOptions = {
  edition: string;
  winesPath: string;
  ratingsPath: string;
  criticPath: string | null;
  dbPath: string;
};

type WineRow = {
  id: number; name: string; type: string; elaborate: string; abv: number | null;
  body: string; acidity: string; country_code: string; country: string;
  region_id: number | null; region: string; winery_id: number | null; winery: string;
  website: string; grapes: string[]; pairings: string[]; vintages: number[]; non_vintage: number;
  rating_count: number; rating_avg: number | null;
};

type Rating = { user: number; wine: number; value: number };

/** Votes of "global average" mixed into every wine/region score, to keep a
 *  single 5-star rating from topping the charts. */
const PRIOR_RATINGS = 25;

export async function build(opts: BuildOptions): Promise<void> {
  const tmp = `${opts.dbPath}.building`;
  await mkdir(path.dirname(opts.dbPath), { recursive: true });
  await rm(tmp, { force: true });

  const db = new Database(tmp);
  db.pragma('journal_mode = OFF');
  db.pragma('synchronous = OFF');
  db.function('grape_key', (v: unknown) => grapeKey(String(v ?? '')));
  db.function('country_code', (v: unknown) => countryCode(String(v ?? '')));
  db.exec(CATALOGUE_SCHEMA);

  const wines = await loadWines(db, opts.winesPath);
  const ratings = await loadRatings(db, opts.ratingsPath, wines);
  deriveWineRatings(db, wines);
  deriveEntities(db, wines);

  let criticCount = 0;
  if (opts.criticPath) criticCount = await loadCritics(db, opts.criticPath);

  buildProfileSimilarity(db, wines);
  buildTasteSimilarity(db, ratings);
  buildSearchIndex(db, wines);

  const meta = db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)');
  meta.run('built_at', new Date().toISOString());
  meta.run('edition', opts.edition);
  meta.run('wine_count', String(wines.size));
  meta.run('rating_count', String(ratings.length));
  meta.run('critic_count', String(criticCount));

  db.exec('PRAGMA optimize');
  db.exec('VACUUM');
  db.close();
  await rm(opts.dbPath, { force: true });
  await rename(tmp, opts.dbPath);
}

/* -------------------------------------------------------------- catalogue */

async function loadWines(db: Db, file: string): Promise<Map<number, WineRow>> {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO wines (
      id, name, type, elaborate, abv, body, acidity, country_code, country,
      region_id, region, winery_id, winery, website, grapes, pairings, vintages,
      vintage_min, vintage_max, vintage_count, non_vintage
    ) VALUES (
      @id, @name, @type, @elaborate, @abv, @body, @acidity, @country_code, @country,
      @region_id, @region, @winery_id, @winery, @website, @grapes, @pairings, @vintages,
      @vintage_min, @vintage_max, @vintage_count, @non_vintage
    )`);
  const insGrape = db.prepare('INSERT OR IGNORE INTO wine_grapes (wine_id, grape) VALUES (?, ?)');
  const insPairing = db.prepare('INSERT OR IGNORE INTO wine_pairings (wine_id, pairing) VALUES (?, ?)');
  const insVintage = db.prepare('INSERT OR IGNORE INTO wine_vintages (wine_id, vintage) VALUES (?, ?)');

  const rows: WineRow[] = [];
  for await (const r of readCsvObjects(file)) {
    const id = num(r.WineID);
    if (id === null) continue;
    const rawVintages = parsePyList(r.Vintages);
    const vintages = rawVintages.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 1800);
    vintages.sort((a, b) => b - a);
    rows.push({
      id,
      name: (r.WineName ?? '').trim(),
      type: (r.Type ?? '').trim(),
      elaborate: (r.Elaborate ?? '').trim(),
      abv: num(r.ABV),
      body: (r.Body ?? '').trim(),
      acidity: (r.Acidity ?? '').trim(),
      country_code: (r.Code ?? '').trim(),
      country: (r.Country ?? '').trim(),
      region_id: num(r.RegionID),
      region: (r.RegionName ?? '').trim(),
      winery_id: num(r.WineryID),
      winery: (r.WineryName ?? '').trim(),
      website: (r.Website ?? '').trim(),
      grapes: parsePyList(r.Grapes),
      pairings: parsePyList(r.Harmonize),
      vintages,
      non_vintage: rawVintages.some((v) => /^n\.?v\.?$/i.test(v)) ? 1 : 0,
      rating_count: 0,
      rating_avg: null,
    });
  }

  db.transaction(() => {
    for (const w of rows) {
      insert.run({
        ...w,
        grapes: JSON.stringify(w.grapes),
        pairings: JSON.stringify(w.pairings),
        vintages: JSON.stringify(w.vintages),
        vintage_min: w.vintages.length ? w.vintages[w.vintages.length - 1] : null,
        vintage_max: w.vintages.length ? w.vintages[0] : null,
        vintage_count: w.vintages.length,
      });
      for (const g of w.grapes) insGrape.run(w.id, g);
      for (const p of w.pairings) insPairing.run(w.id, p);
      for (const v of w.vintages) insVintage.run(w.id, v);
    }
  })();

  console.log(`  wines    ${rows.length.toLocaleString()}`);
  return new Map(rows.map((w) => [w.id, w]));
}

async function loadRatings(db: Db, file: string, wines: Map<number, WineRow>): Promise<Rating[]> {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO ratings (id, user_id, wine_id, vintage, rating, rated_at, ym, year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  type Args = [number, number, number, number | null, number, string | null, string | null, number | null];
  const batch: Args[] = [];
  const out: Rating[] = [];
  let orphans = 0;
  let fallbackId = 0;

  const flush = db.transaction((items: Args[]) => {
    for (const args of items) insert.run(...args);
  });

  for await (const r of readCsvObjects(file)) {
    const wine = num(r.WineID);
    const value = num(r.Rating);
    const user = num(r.UserID);
    if (wine === null || value === null || user === null) continue;
    if (!wines.has(wine)) {
      orphans++;
      continue;
    }
    const at = (r.Date ?? '').trim();
    fallbackId += 1;
    const id = num(r.RatingID) ?? fallbackId;
    batch.push([id, user, wine, num(r.Vintage), value, at || null, at ? at.slice(0, 7) : null, at ? Number(at.slice(0, 4)) : null]);
    out.push({ user, wine, value });
    if (batch.length >= 20_000) flush(batch.splice(0, batch.length));
  }
  if (batch.length) flush(batch);

  const skipped = orphans ? ` (${orphans.toLocaleString()} skipped: wine not in this edition)` : '';
  console.log(`  ratings  ${out.length.toLocaleString()}${skipped}`);
  return out;
}

function deriveWineRatings(db: Db, wines: Map<number, WineRow>): void {
  db.exec(`
    UPDATE wines SET
      rating_count = COALESCE((SELECT COUNT(*) FROM ratings r WHERE r.wine_id = wines.id), 0),
      rating_avg   = (SELECT AVG(r.rating) FROM ratings r WHERE r.wine_id = wines.id),
      first_rated  = (SELECT MIN(r.rated_at) FROM ratings r WHERE r.wine_id = wines.id),
      last_rated   = (SELECT MAX(r.rated_at) FROM ratings r WHERE r.wine_id = wines.id);

    INSERT INTO wine_rating_hist (wine_id, bucket, n)
      SELECT wine_id, rating, COUNT(*) FROM ratings GROUP BY wine_id, rating;
  `);

  const globalAvg = (db.prepare('SELECT AVG(rating) AS a FROM ratings').get() as { a: number | null }).a ?? 0;
  db.prepare(`
    UPDATE wines SET rating_score = CASE
      WHEN rating_count > 0 THEN (rating_count * rating_avg + ? * ?) / (rating_count + ?)
      ELSE NULL END`).run(PRIOR_RATINGS, globalAvg, PRIOR_RATINGS);
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('global_rating_avg', String(globalAvg));

  const rows = db.prepare('SELECT id, rating_count, rating_avg FROM wines').all() as
    { id: number; rating_count: number; rating_avg: number | null }[];
  for (const row of rows) {
    const w = wines.get(row.id);
    if (w) {
      w.rating_count = row.rating_count;
      w.rating_avg = row.rating_avg;
    }
  }
}

/* ------------------------------------------------ grape / place roll-ups */

function mode(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
}

function topEntries(map: Map<string, number>, limit: number): { name: string; count: number }[] {
  return [...map].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));
}

type Agg = {
  wines: number; ratings: number; ratingSum: number; abvSum: number; abvN: number;
  grapes: Map<string, number>; types: Map<string, number>; bodies: Map<string, number>;
  acidities: Map<string, number>; regions: Set<number>; wineries: Set<number>;
  countries: Map<string, number>; pairings: Map<string, number>; blends: Map<string, number>;
  varietal: number; label: string; extra: Record<string, unknown>;
};

function blankAgg(label: string, extra: Record<string, unknown> = {}): Agg {
  return {
    wines: 0, ratings: 0, ratingSum: 0, abvSum: 0, abvN: 0,
    grapes: new Map(), types: new Map(), bodies: new Map(), acidities: new Map(),
    regions: new Set(), wineries: new Set(), countries: new Map(), pairings: new Map(),
    blends: new Map(), varietal: 0, label, extra,
  };
}

function deriveEntities(db: Db, wines: Map<number, WineRow>): void {
  const globalRow = db.prepare("SELECT value FROM meta WHERE key = 'global_rating_avg'").get() as { value: string } | undefined;
  const globalAvg = Number(globalRow?.value ?? 0);
  const shrink = (count: number, avg: number | null) =>
    count > 0 && avg !== null ? (count * avg + PRIOR_RATINGS * globalAvg) / (count + PRIOR_RATINGS) : null;

  const byCountry = new Map<string, Agg>();
  const byRegion = new Map<number, Agg>();
  const byWinery = new Map<number, Agg>();
  const byGrape = new Map<string, Agg>();

  const add = (agg: Agg, w: WineRow) => {
    agg.wines++;
    agg.ratings += w.rating_count;
    agg.ratingSum += (w.rating_avg ?? 0) * w.rating_count;
    if (w.abv !== null) {
      agg.abvSum += w.abv;
      agg.abvN++;
    }
    bump(agg.types, w.type);
    bump(agg.bodies, w.body);
    bump(agg.acidities, w.acidity);
    bump(agg.countries, w.country);
    for (const g of w.grapes) bump(agg.grapes, g);
    for (const p of w.pairings) bump(agg.pairings, p);
    if (w.region_id !== null) agg.regions.add(w.region_id);
    if (w.winery_id !== null) agg.wineries.add(w.winery_id);
  };

  for (const w of wines.values()) {
    if (w.country_code) {
      if (!byCountry.has(w.country_code)) byCountry.set(w.country_code, blankAgg(w.country));
      add(byCountry.get(w.country_code)!, w);
    }
    if (w.region_id !== null) {
      if (!byRegion.has(w.region_id)) byRegion.set(w.region_id, blankAgg(w.region, { country: w.country, code: w.country_code }));
      add(byRegion.get(w.region_id)!, w);
    }
    if (w.winery_id !== null) {
      if (!byWinery.has(w.winery_id)) {
        byWinery.set(w.winery_id, blankAgg(w.winery, { country: w.country, region: w.region, region_id: w.region_id, website: w.website }));
      }
      add(byWinery.get(w.winery_id)!, w);
    }
    for (const g of w.grapes) {
      if (!byGrape.has(g)) byGrape.set(g, blankAgg(g));
      const agg = byGrape.get(g)!;
      add(agg, w);
      if (w.elaborate.startsWith('Varietal')) agg.varietal++;
      for (const other of w.grapes) if (other !== g) bump(agg.blends, other);
    }
  }

  const insCountry = db.prepare(`INSERT OR REPLACE INTO countries
    (code, name, wine_count, region_count, winery_count, rating_count, rating_avg, rating_score, abv_avg, top_grape, top_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insRegion = db.prepare(`INSERT OR REPLACE INTO regions
    (id, name, country, country_code, wine_count, winery_count, rating_count, rating_avg, rating_score, top_grape, top_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insWinery = db.prepare(`INSERT OR REPLACE INTO wineries
    (id, name, country, region, region_id, website, wine_count, rating_count, rating_avg, rating_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insGrape = db.prepare(`INSERT OR REPLACE INTO grapes
    (name, wine_count, varietal_count, rating_count, rating_avg, abv_avg, top_type, top_country, top_body, top_acidity, pairings, blends_with, countries)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  db.transaction(() => {
    for (const [code, a] of byCountry) {
      const avg = a.ratings ? a.ratingSum / a.ratings : null;
      insCountry.run(code, a.label, a.wines, a.regions.size, a.wineries.size, a.ratings, avg,
        shrink(a.ratings, avg), a.abvN ? a.abvSum / a.abvN : null, mode(a.grapes), mode(a.types));
    }
    for (const [id, a] of byRegion) {
      const avg = a.ratings ? a.ratingSum / a.ratings : null;
      insRegion.run(id, a.label, a.extra.country as string, a.extra.code as string, a.wines, a.wineries.size,
        a.ratings, avg, shrink(a.ratings, avg), mode(a.grapes), mode(a.types));
    }
    for (const [id, a] of byWinery) {
      const avg = a.ratings ? a.ratingSum / a.ratings : null;
      insWinery.run(id, a.label, a.extra.country as string, a.extra.region as string,
        (a.extra.region_id as number | null) ?? null, (a.extra.website as string) || null,
        a.wines, a.ratings, avg, shrink(a.ratings, avg));
    }
    for (const [name, a] of byGrape) {
      const avg = a.ratings ? a.ratingSum / a.ratings : null;
      insGrape.run(name, a.wines, a.varietal, a.ratings, avg, a.abvN ? a.abvSum / a.abvN : null,
        mode(a.types), mode(a.countries), mode(a.bodies), mode(a.acidities),
        JSON.stringify(topEntries(a.pairings, 8)), JSON.stringify(topEntries(a.blends, 6)),
        JSON.stringify(topEntries(a.countries, 6)));
    }
  })();

  console.log(`  rollups  ${byCountry.size} countries, ${byRegion.size} regions, ${byWinery.size} wineries, ${byGrape.size} grapes`);
}

/* ---------------------------------------------------------- critic notes */

async function loadCritics(db: Db, file: string): Promise<number> {
  const insert = db.prepare(`
    INSERT INTO critic_reviews (id, title, wine_name, vintage, variety, grape_key, country, province, region, winery, points, price, value, taster, description)
    VALUES (@id, @title, @wine_name, @vintage, @variety, @grape_key, @country, @province, @region, @winery, @points, @price, @value, @taster, @description)`);
  const insFts = db.prepare('INSERT INTO critic_fts (rowid, title, variety, winery, description) VALUES (?, ?, ?, ?, ?)');

  type Bucket = { n: number; points: number; prices: number[] };
  const buckets = new Map<string, Bucket>();
  const descriptorCounts = new Map<string, Map<string, { n: number; family: string }>>();
  const scopeTotals = new Map<string, number>();

  const trackDescriptor = (id: string, word: string, family: string) => {
    let m = descriptorCounts.get(id);
    if (!m) {
      m = new Map();
      descriptorCounts.set(id, m);
    }
    const cur = m.get(word);
    if (cur) cur.n++;
    else m.set(word, { n: 1, family });
  };

  const rows: Record<string, unknown>[] = [];
  const ftsRows: [number, string, string, string, string][] = [];
  let id = 0;
  let count = 0;

  const flush = db.transaction(() => {
    for (const r of rows) insert.run(r as never);
    for (const f of ftsRows) insFts.run(...f);
    rows.length = 0;
    ftsRows.length = 0;
  });

  for await (const r of readCsvObjects(file)) {
    const points = num(r.points);
    if (points === null) continue;
    id++;
    const price = num(r.price);
    const variety = (r.variety ?? '').trim();
    const key = variety ? grapeKey(variety) : '';
    const country = (r.country ?? '').trim();
    const title = (r.title ?? '').trim();
    const description = (r.description ?? '').trim();

    rows.push({
      id,
      title,
      wine_name: (r.designation ?? '').trim() || null,
      vintage: vintageFromTitle(title),
      variety: variety || null,
      grape_key: key || null,
      country: country || null,
      province: (r.province ?? '').trim() || null,
      region: (r.region_1 ?? '').trim() || null,
      winery: (r.winery ?? '').trim() || null,
      points,
      price,
      value: price && price > 0 ? points / price : null,
      taster: (r.taster_name ?? '').trim() || null,
      description,
    });
    ftsRows.push([id, title, variety, (r.winery ?? '').trim(), description]);
    count++;

    const scopes: [string, string][] = [['grape', key], ['country', country]];
    const iso = country ? countryCode(country) : null;
    if (key && iso) scopes.push(['grape_country', `${key}~${iso}`]);
    for (const [scope, value] of scopes) {
      if (!value) continue;
      const bkey = `${scope}|${value}`;
      let b = buckets.get(bkey);
      if (!b) {
        b = { n: 0, points: 0, prices: [] };
        buckets.set(bkey, b);
      }
      b.n++;
      b.points += points;
      if (price !== null) b.prices.push(price);
    }

    scopeTotals.set('global|all', (scopeTotals.get('global|all') ?? 0) + 1);
    if (key) scopeTotals.set(`grape|${key}`, (scopeTotals.get(`grape|${key}`) ?? 0) + 1);
    if (country) scopeTotals.set(`country|${country}`, (scopeTotals.get(`country|${country}`) ?? 0) + 1);
    for (const t of extractDescriptors(description)) {
      trackDescriptor('global|all', t.term, t.family);
      if (key) trackDescriptor(`grape|${key}`, t.term, t.family);
      if (country) trackDescriptor(`country|${country}`, t.term, t.family);
    }

    if (rows.length >= 10_000) flush();
  }
  flush();

  const insStats = db.prepare(`INSERT OR REPLACE INTO critic_stats
    (scope, key, n, points_avg, price_avg, price_med, price_p10, price_p90) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => {
    for (const [bkey, b] of buckets) {
      if (b.n < 5) continue;
      const [scope, key] = bkey.split('|');
      const prices = b.prices.sort((x, y) => x - y);
      const pct = (p: number) => (prices.length ? prices[Math.min(prices.length - 1, Math.floor(p * prices.length))] : null);
      const avgPrice = prices.length ? prices.reduce((s, x) => s + x, 0) / prices.length : null;
      insStats.run(scope, key, b.n, b.points / b.n, avgPrice, pct(0.5), pct(0.1), pct(0.9));
    }
  })();

  const globalTotal = scopeTotals.get('global|all') ?? 1;
  const globalShare = new Map<string, number>();
  for (const [word, { n }] of descriptorCounts.get('global|all') ?? []) globalShare.set(word, n / globalTotal);

  const insDesc = db.prepare('INSERT OR REPLACE INTO descriptors (scope, key, word, family, n, share, lift) VALUES (?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    for (const [scopeKey, words] of descriptorCounts) {
      const [scope, key] = scopeKey.split('|');
      const total = scopeTotals.get(scopeKey) ?? 1;
      if (scope !== 'global' && total < 30) continue;
      for (const [word, { n, family }] of words) {
        if (n < 3) continue;
        const share = n / total;
        insDesc.run(scope, key, word, family, n, share, share / (globalShare.get(word) || share));
      }
    }
  })();

  // Fold critic scores and prices into the grape and country tables, matching
  // "Syrah/Shiraz" to "Shiraz" and "United States" to "US" along the way.
  db.exec(`
    UPDATE grapes SET
      critic_n = COALESCE((SELECT n FROM critic_stats c WHERE c.scope = 'grape' AND c.key = grape_key(grapes.name)), 0),
      critic_points = (SELECT points_avg FROM critic_stats c WHERE c.scope = 'grape' AND c.key = grape_key(grapes.name)),
      critic_price = (SELECT price_med FROM critic_stats c WHERE c.scope = 'grape' AND c.key = grape_key(grapes.name));

    UPDATE countries SET
      critic_n = COALESCE((SELECT SUM(n) FROM critic_stats c WHERE c.scope = 'country' AND country_code(c.key) = countries.code), 0),
      critic_points = (SELECT AVG(points_avg) FROM critic_stats c WHERE c.scope = 'country' AND country_code(c.key) = countries.code),
      critic_price = (SELECT AVG(price_med) FROM critic_stats c WHERE c.scope = 'country' AND country_code(c.key) = countries.code);
  `);

  console.log(`  critics  ${count.toLocaleString()} reviews, ${buckets.size.toLocaleString()} price/score buckets`);
  return count;
}

/* -------------------------------------------------------------- neighbours */

/**
 * Content similarity: every wine becomes a weighted feature vector (grapes
 * count most, then style, then origin) and we keep its 12 nearest cosines.
 * Candidates come from an inverted index, so this stays tractable on the
 * 100K-wine edition instead of going quadratic.
 */
function buildProfileSimilarity(db: Db, wines: Map<number, WineRow>): void {
  const features = new Map<number, Map<string, number>>();
  const index = new Map<string, number[]>();
  const norms = new Map<number, number>();
  const pushIndex = (key: string, id: number) => {
    let list = index.get(key);
    if (!list) {
      list = [];
      index.set(key, list);
    }
    list.push(id);
  };

  for (const w of wines.values()) {
    const f = new Map<string, number>();
    const put = (k: string, v: number) => f.set(k, (f.get(k) ?? 0) + v);
    for (const g of w.grapes) put(`g:${grapeKey(g)}`, 3 / Math.sqrt(w.grapes.length || 1));
    put(`t:${w.type}`, 2);
    put(`b:${w.body}`, 1.2);
    put(`a:${w.acidity}`, 0.8);
    put(`c:${w.country_code}`, 1);
    put(`r:${w.region_id}`, 0.6);
    put(`e:${w.elaborate.split('/')[0]}`, 0.4);
    if (w.abv !== null) put(`v:${Math.round(w.abv / 1.5)}`, 0.6);
    for (const p of w.pairings) put(`p:${p}`, 0.5 / Math.sqrt(w.pairings.length || 1));

    features.set(w.id, f);
    norms.set(w.id, Math.sqrt([...f.values()].reduce((s, x) => s + x * x, 0)));
    for (const g of w.grapes) pushIndex(`g:${grapeKey(g)}`, w.id);
    pushIndex(`tc:${w.type}|${w.country_code}`, w.id);
  }

  const insert = db.prepare('INSERT OR REPLACE INTO wine_similar (wine_id, other_id, kind, score) VALUES (?, ?, ?, ?)');
  const CANDIDATE_CAP = 400;

  db.transaction(() => {
    for (const w of wines.values()) {
      const candidates = new Set<number>();
      for (const g of w.grapes) for (const id of (index.get(`g:${grapeKey(g)}`) ?? []).slice(0, CANDIDATE_CAP)) candidates.add(id);
      for (const id of (index.get(`tc:${w.type}|${w.country_code}`) ?? []).slice(0, CANDIDATE_CAP)) candidates.add(id);
      candidates.delete(w.id);

      const mine = features.get(w.id)!;
      const myNorm = norms.get(w.id) || 1;
      const scored: { id: number; score: number }[] = [];
      for (const other of candidates) {
        const theirs = features.get(other);
        if (!theirs) continue;
        const [small, large] = mine.size < theirs.size ? [mine, theirs] : [theirs, mine];
        let dot = 0;
        for (const [k, v] of small) {
          const o = large.get(k);
          if (o) dot += v * o;
        }
        const score = dot / (myNorm * (norms.get(other) || 1));
        if (score > 0.25) scored.push({ id: other, score });
      }
      scored.sort((a, b) => b.score - a.score);
      for (const s of scored.slice(0, 12)) insert.run(w.id, s.id, 'profile', s.score);
    }
  })();
  console.log('  profile neighbours built');
}

/**
 * Taste similarity: item-item cosine over mean-centred user ratings, i.e.
 * "drinkers who loved this also loved". Prolific users are capped so a single
 * power taster cannot dominate the co-occurrence counts, and pairs seen by few
 * shared raters are damped rather than trusted.
 */
function buildTasteSimilarity(db: Db, ratings: Rating[]): void {
  const MAX_PER_USER = 150;
  const MIN_SHARED_RATERS = 3;
  const byUser = new Map<number, Rating[]>();
  for (const r of ratings) {
    let list = byUser.get(r.user);
    if (!list) {
      list = [];
      byUser.set(r.user, list);
    }
    if (list.length < MAX_PER_USER) list.push(r);
  }

  const dot = new Map<number, Map<number, number>>();
  const shared = new Map<number, Map<number, number>>();
  const sq = new Map<number, number>();
  const accumulate = (store: Map<number, Map<number, number>>, a: number, b: number, v: number) => {
    let row = store.get(a);
    if (!row) {
      row = new Map();
      store.set(a, row);
    }
    row.set(b, (row.get(b) ?? 0) + v);
  };

  for (const list of byUser.values()) {
    if (list.length < 2) continue;
    const mean = list.reduce((s, r) => s + r.value, 0) / list.length;
    const centred = list.map((r) => ({ wine: r.wine, v: r.value - mean }));
    for (const { wine, v } of centred) sq.set(wine, (sq.get(wine) ?? 0) + v * v);
    for (let i = 0; i < centred.length; i++) {
      for (let j = i + 1; j < centred.length; j++) {
        const a = centred[i];
        const b = centred[j];
        const product = a.v * b.v;
        accumulate(dot, a.wine, b.wine, product);
        accumulate(dot, b.wine, a.wine, product);
        accumulate(shared, a.wine, b.wine, 1);
        accumulate(shared, b.wine, a.wine, 1);
      }
    }
  }

  const insert = db.prepare('INSERT OR REPLACE INTO wine_similar (wine_id, other_id, kind, score) VALUES (?, ?, ?, ?)');
  let written = 0;
  db.transaction(() => {
    for (const [wine, others] of dot) {
      const normA = Math.sqrt(sq.get(wine) ?? 0);
      if (!normA) continue;
      const scored: { id: number; score: number }[] = [];
      for (const [other, product] of others) {
        const co = shared.get(wine)?.get(other) ?? 0;
        if (co < MIN_SHARED_RATERS) continue;
        const denom = normA * Math.sqrt(sq.get(other) ?? 0);
        if (!denom) continue;
        const score = (product / denom) * (co / (co + 5));
        if (score > 0.02) scored.push({ id: other, score });
      }
      scored.sort((a, b) => b.score - a.score);
      for (const s of scored.slice(0, 12)) {
        insert.run(wine, s.id, 'taste', s.score);
        written++;
      }
    }
  })();
  console.log(`  taste neighbours: ${written.toLocaleString()} pairs`);
}

function buildSearchIndex(db: Db, wines: Map<number, WineRow>): void {
  const insert = db.prepare(
    'INSERT INTO wines_fts (rowid, name, winery, region, country, grapes, pairings) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  db.transaction(() => {
    for (const w of wines.values()) {
      insert.run(w.id, w.name, w.winery, w.region, w.country, w.grapes.join(' '), w.pairings.join(' '));
    }
  })();
  console.log('  search index built');
}
