import { Router } from 'express';
import { getDb } from '../db.js';
import { CARD_COLUMNS, hydrate } from '../lib/wineQuery.js';
import { grapeKey } from '../lib/taxonomy.js';
import { int, str } from '../lib/params.js';

export const referenceRouter = Router();

const topWines = (sqlWhere: string, limit = 12) => `
  SELECT ${CARD_COLUMNS} FROM wines w
  WHERE ${sqlWhere}
  ORDER BY w.rating_score DESC NULLS LAST, w.rating_count DESC
  LIMIT ${limit}`;

referenceRouter.get('/grapes', (req, res) => {
  const db = getDb();
  const q = str(req.query.q);
  const rows = q
    ? db.prepare('SELECT * FROM grapes WHERE name LIKE ? ORDER BY wine_count DESC').all(`%${q}%`)
    : db.prepare('SELECT * FROM grapes ORDER BY wine_count DESC').all();
  res.json(
    rows.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        ...row,
        pairings: JSON.parse(String(row.pairings ?? '[]')),
        blends_with: JSON.parse(String(row.blends_with ?? '[]')),
        countries: JSON.parse(String(row.countries ?? '[]')),
      };
    }),
  );
});

referenceRouter.get('/grapes/:name', (req, res) => {
  const db = getDb();
  const name = req.params.name;
  const row = db.prepare('SELECT * FROM grapes WHERE name = ?').get(name) as Record<string, unknown> | undefined;
  if (!row) {
    res.status(404).json({ error: 'grape not found' });
    return;
  }
  const key = grapeKey(name);
  res.json({
    grape: {
      ...row,
      pairings: JSON.parse(String(row.pairings ?? '[]')),
      blends_with: JSON.parse(String(row.blends_with ?? '[]')),
      countries: JSON.parse(String(row.countries ?? '[]')),
    },
    wines: db
      .prepare(topWines('EXISTS (SELECT 1 FROM wine_grapes g WHERE g.wine_id = w.id AND g.grape = ?)', 12))
      .all(name)
      .map((r) => hydrate(r as Record<string, unknown>)),
    flavours: db
      .prepare("SELECT word, family, n, share, lift FROM descriptors WHERE scope = 'grape' AND key = ? ORDER BY lift DESC LIMIT 18")
      .all(key),
    critic: db.prepare("SELECT * FROM critic_stats WHERE scope = 'grape' AND key = ?").get(key) ?? null,
    criticByCountry: db
      .prepare(`SELECT SUBSTR(key, INSTR(key, '~') + 1) AS country, n, points_avg, price_med
                FROM critic_stats WHERE scope = 'grape_country' AND key LIKE ? AND n >= 20
                ORDER BY points_avg DESC LIMIT 12`)
      .all(`${key}~%`),
    reviews: db
      .prepare(`SELECT id, title, variety, country, points, price, description, taster
                FROM critic_reviews WHERE grape_key = ? AND points >= 92 ORDER BY RANDOM() LIMIT 3`)
      .all(key),
  });
});

referenceRouter.get('/countries', (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM countries ORDER BY wine_count DESC').all());
});

referenceRouter.get('/countries/:code', (req, res) => {
  const db = getDb();
  const code = req.params.code.toUpperCase();
  const country = db.prepare('SELECT * FROM countries WHERE code = ?').get(code) as Record<string, unknown> | undefined;
  if (!country) {
    res.status(404).json({ error: 'country not found' });
    return;
  }
  res.json({
    country,
    regions: db
      .prepare(`SELECT * FROM regions WHERE country_code = ? ORDER BY wine_count DESC, rating_score DESC LIMIT 40`)
      .all(code),
    grapes: db
      .prepare(`SELECT g.grape AS name, COUNT(*) AS wines, AVG(w.rating_score) AS score
                FROM wine_grapes g JOIN wines w ON w.id = g.wine_id
                WHERE w.country_code = ? GROUP BY g.grape ORDER BY wines DESC LIMIT 12`)
      .all(code),
    wines: db.prepare(topWines('w.country_code = ?', 12)).all(code).map((r) => hydrate(r as Record<string, unknown>)),
    flavours: db
      .prepare(`SELECT word, family, n, share, lift FROM descriptors
                WHERE scope = 'country' AND country_code(key) = ? ORDER BY lift DESC LIMIT 15`)
      .all(code),
  });
});

referenceRouter.get('/regions/:id', (req, res) => {
  const db = getDb();
  const id = int(req.params.id);
  const region = db.prepare('SELECT * FROM regions WHERE id = ?').get(id);
  if (!region) {
    res.status(404).json({ error: 'region not found' });
    return;
  }
  res.json({
    region,
    wines: db.prepare(topWines('w.region_id = ?', 24)).all(id).map((r) => hydrate(r as Record<string, unknown>)),
    grapes: db
      .prepare(`SELECT g.grape AS name, COUNT(*) AS wines FROM wine_grapes g JOIN wines w ON w.id = g.wine_id
                WHERE w.region_id = ? GROUP BY g.grape ORDER BY wines DESC LIMIT 10`)
      .all(id),
    wineries: db.prepare('SELECT * FROM wineries WHERE region_id = ? ORDER BY rating_score DESC NULLS LAST LIMIT 20').all(id),
  });
});

referenceRouter.get('/wineries/:id', (req, res) => {
  const db = getDb();
  const id = int(req.params.id);
  const winery = db.prepare('SELECT * FROM wineries WHERE id = ?').get(id);
  if (!winery) {
    res.status(404).json({ error: 'winery not found' });
    return;
  }
  res.json({
    winery,
    wines: db.prepare(topWines('w.winery_id = ?', 40)).all(id).map((r) => hydrate(r as Record<string, unknown>)),
  });
});

/** Food pairings, as tagged by the X-Wines "harmonize" field. */
referenceRouter.get('/pairings', (_req, res) => {
  const db = getDb();
  res.json(
    db
      .prepare(`SELECT p.pairing AS name, COUNT(*) AS wines, AVG(w.rating_score) AS score
                FROM wine_pairings p JOIN wines w ON w.id = p.wine_id
                GROUP BY p.pairing ORDER BY wines DESC`)
      .all(),
  );
});

referenceRouter.get('/pairings/:name', (req, res) => {
  const db = getDb();
  const name = req.params.name;
  const type = str(req.query.type);
  const typeClause = type ? 'AND w.type = ?' : '';
  const params: unknown[] = type ? [name, type] : [name];

  res.json({
    pairing: name,
    types: db
      .prepare(`SELECT w.type, COUNT(*) AS wines, AVG(w.rating_score) AS score
                FROM wine_pairings p JOIN wines w ON w.id = p.wine_id
                WHERE p.pairing = ? GROUP BY w.type ORDER BY wines DESC`)
      .all(name),
    grapes: db
      .prepare(`SELECT g.grape AS name, COUNT(*) AS wines FROM wine_pairings p
                JOIN wine_grapes g ON g.wine_id = p.wine_id
                WHERE p.pairing = ? GROUP BY g.grape ORDER BY wines DESC LIMIT 10`)
      .all(name),
    wines: db
      .prepare(`SELECT ${CARD_COLUMNS} FROM wines w
                JOIN wine_pairings p ON p.wine_id = w.id
                WHERE p.pairing = ? ${typeClause}
                ORDER BY w.rating_score DESC NULLS LAST, w.rating_count DESC LIMIT 18`)
      .all(...params)
      .map((r) => hydrate(r as Record<string, unknown>)),
  });
});

/** Everything the filter sidebar needs in one call. */
referenceRouter.get('/facets', (_req, res) => {
  const db = getDb();
  res.json({
    types: db.prepare("SELECT type AS value, COUNT(*) AS count FROM wines WHERE type <> '' GROUP BY type ORDER BY count DESC").all(),
    bodies: db.prepare("SELECT body AS value, COUNT(*) AS count FROM wines WHERE body <> '' GROUP BY body ORDER BY count DESC").all(),
    acidities: db.prepare("SELECT acidity AS value, COUNT(*) AS count FROM wines WHERE acidity <> '' GROUP BY acidity ORDER BY count DESC").all(),
    countries: db.prepare('SELECT code AS value, name AS label, wine_count AS count FROM countries ORDER BY wine_count DESC').all(),
    grapes: db.prepare('SELECT name AS value, wine_count AS count FROM grapes ORDER BY wine_count DESC LIMIT 80').all(),
    pairings: db
      .prepare('SELECT pairing AS value, COUNT(*) AS count FROM wine_pairings GROUP BY pairing ORDER BY count DESC')
      .all(),
    vintages: db
      .prepare('SELECT vintage AS value, COUNT(*) AS count FROM wine_vintages GROUP BY vintage HAVING count >= 5 ORDER BY vintage DESC')
      .all(),
  });
});
