import { Router } from 'express';
import type { Request } from 'express';
import { getDb } from '../db.js';
import { CARD_COLUMNS, hydrate, queryWines, ftsQuery } from '../lib/wineQuery.js';
import type { WineFilters } from '../lib/wineQuery.js';
import { float, int, list, numbers, str } from '../lib/params.js';
import { grapeKey } from '../lib/taxonomy.js';

export const winesRouter = Router();

function filtersFrom(req: Request): WineFilters {
  return {
    q: str(req.query.q),
    type: list(req, 'type'),
    country: list(req, 'country'),
    region: numbers(req, 'region'),
    winery: numbers(req, 'winery'),
    grape: list(req, 'grape'),
    pairing: list(req, 'pairing'),
    body: list(req, 'body'),
    acidity: list(req, 'acidity'),
    abvMin: float(req.query.abvMin),
    abvMax: float(req.query.abvMax),
    vintage: int(req.query.vintage),
    minRatings: int(req.query.minRatings),
    maxRatings: int(req.query.maxRatings),
    sort: str(req.query.sort),
    page: int(req.query.page, 1),
    pageSize: int(req.query.pageSize, 24),
  };
}

winesRouter.get('/wines', (req, res) => {
  const result = queryWines(getDb(), filtersFrom(req), { facets: req.query.facets !== '0' });
  res.json(result);
});

/** Type-ahead for the search box: a few wines, grapes and regions per keystroke. */
winesRouter.get('/suggest', (req, res) => {
  const db = getDb();
  const q = str(req.query.q);
  const match = q ? ftsQuery(q) : null;
  if (!match) {
    res.json({ wines: [], grapes: [], regions: [], wineries: [] });
    return;
  }
  const like = `%${q}%`;
  res.json({
    wines: db
      .prepare(`SELECT w.id, w.name, w.winery, w.type, w.country FROM wines w
                WHERE w.id IN (SELECT rowid FROM wines_fts WHERE wines_fts MATCH ?)
                ORDER BY w.rating_count DESC LIMIT 6`)
      .all(match),
    grapes: db.prepare('SELECT name, wine_count FROM grapes WHERE name LIKE ? ORDER BY wine_count DESC LIMIT 4').all(like),
    regions: db.prepare('SELECT id, name, country FROM regions WHERE name LIKE ? ORDER BY wine_count DESC LIMIT 4').all(like),
    wineries: db.prepare('SELECT id, name, country FROM wineries WHERE name LIKE ? ORDER BY wine_count DESC LIMIT 4').all(like),
  });
});

winesRouter.get('/wines/random', (req, res) => {
  const db = getDb();
  const filters = filtersFrom(req);
  const result = queryWines(db, { ...filters, sort: 'random', page: 1, pageSize: 1, minRatings: filters.minRatings ?? 20 });
  res.json(result.items[0] ?? null);
});

winesRouter.get('/wines/:id', (req, res) => {
  const db = getDb();
  const id = int(req.params.id);
  const row = db.prepare(`SELECT ${CARD_COLUMNS}, w.website, w.vintages FROM wines w WHERE w.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'wine not found' });
    return;
  }
  const wine = { ...hydrate(row), vintages: JSON.parse(String(row.vintages ?? '[]')) as number[], website: row.website as string };

  const histogram = db.prepare('SELECT bucket, n FROM wine_rating_hist WHERE wine_id = ? ORDER BY bucket').all(id) as
    { bucket: number; n: number }[];

  const byYear = db
    .prepare(`SELECT year, COUNT(*) AS n, AVG(rating) AS avg FROM ratings WHERE wine_id = ? AND year IS NOT NULL
              GROUP BY year ORDER BY year`)
    .all(id) as { year: number; n: number; avg: number }[];

  const byVintage = db
    .prepare(`SELECT vintage, COUNT(*) AS n, AVG(rating) AS avg FROM ratings
              WHERE wine_id = ? AND vintage IS NOT NULL GROUP BY vintage HAVING n >= 3 ORDER BY vintage DESC`)
    .all(id) as { vintage: number; n: number; avg: number }[];

  const similar = (kind: string) =>
    db
      .prepare(`SELECT ${CARD_COLUMNS}, s.score FROM wine_similar s JOIN wines w ON w.id = s.other_id
                WHERE s.wine_id = ? AND s.kind = ?
                ORDER BY s.score DESC, w.rating_count DESC LIMIT 8`)
      .all(id, kind)
      .map((r) => hydrate(r as Record<string, unknown>));

  const mainGrape = wine.grapes[0] ?? null;
  const key = mainGrape ? grapeKey(mainGrape) : null;
  const benchmark = key
    ? (db.prepare("SELECT * FROM critic_stats WHERE scope = 'grape' AND key = ?").get(key) as Record<string, unknown> | undefined)
    : undefined;
  const benchmarkHere = key
    ? (db
        .prepare("SELECT * FROM critic_stats WHERE scope = 'grape_country' AND key = ?")
        .get(`${key}~${wine.country_code}`) as Record<string, unknown> | undefined)
    : undefined;

  const flavours = key
    ? (db
        .prepare(`SELECT word, family, n, share, lift FROM descriptors WHERE scope = 'grape' AND key = ?
                  ORDER BY lift DESC LIMIT 12`)
        .all(key) as Record<string, unknown>[])
    : [];

  // Wine Enthusiast notes for the same producer, when the critics covered them.
  const wineryMatch = ftsQuery(wine.winery);
  const criticNotes = wineryMatch
    ? (db
        .prepare(`SELECT c.id, c.title, c.variety, c.points, c.price, c.description, c.taster, c.vintage
                  FROM critic_fts f JOIN critic_reviews c ON c.id = f.rowid
                  WHERE critic_fts MATCH ? ORDER BY c.points DESC LIMIT 4`)
        .all(`winery : (${wineryMatch})`) as Record<string, unknown>[])
    : [];

  res.json({
    wine,
    winery: db.prepare('SELECT * FROM wineries WHERE id = ?').get(wine.winery_id) ?? null,
    region: db.prepare('SELECT * FROM regions WHERE id = ?').get(wine.region_id) ?? null,
    country: db.prepare('SELECT * FROM countries WHERE code = ?').get(wine.country_code) ?? null,
    histogram,
    byYear,
    byVintage,
    similar: { profile: similar('profile'), taste: similar('taste') },
    benchmark: benchmark ?? null,
    benchmarkHere: benchmarkHere ?? null,
    flavours,
    criticNotes,
    cellar: {
      bottles: db.prepare('SELECT * FROM cellar.cellar_bottles WHERE wine_id = ? ORDER BY created_at DESC').all(id),
      notes: db.prepare('SELECT * FROM cellar.tasting_notes WHERE wine_id = ? ORDER BY tasted_on DESC').all(id),
      wishlisted: Boolean(db.prepare('SELECT 1 AS x FROM cellar.wishlist WHERE wine_id = ?').get(id)),
    },
  });
});
