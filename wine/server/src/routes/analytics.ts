import { Router } from 'express';
import type { Request } from 'express';
import { getDb, meta } from '../db.js';
import { buildWhere } from '../lib/wineQuery.js';
import { int, list, str } from '../lib/params.js';

export const analyticsRouter = Router();

/** Panels share the catalogue filters, so every chart answers the same question. */
function scope(req: Request): { where: string; params: unknown[]; joinWhere: string } {
  const { sql, params } = buildWhere({
    type: list(req, 'type'),
    country: list(req, 'country'),
    grape: list(req, 'grape'),
    body: list(req, 'body'),
    minRatings: int(req.query.minRatings),
  });
  return { where: sql, params, joinWhere: sql };
}

analyticsRouter.get('/analytics/summary', (_req, res) => {
  const db = getDb();
  const row = db
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM wines)                       AS wines,
        (SELECT COUNT(*) FROM ratings)                     AS ratings,
        (SELECT COUNT(DISTINCT user_id) FROM ratings)      AS tasters,
        (SELECT ROUND(AVG(rating), 3) FROM ratings)        AS avg_rating,
        (SELECT COUNT(*) FROM countries)                   AS countries,
        (SELECT COUNT(*) FROM regions)                     AS regions,
        (SELECT COUNT(*) FROM wineries)                    AS wineries,
        (SELECT COUNT(*) FROM grapes)                      AS grapes,
        (SELECT COUNT(*) FROM critic_reviews)              AS critic_reviews,
        (SELECT ROUND(AVG(points), 2) FROM critic_reviews) AS critic_points,
        (SELECT MIN(rated_at) FROM ratings)                AS first_rating,
        (SELECT MAX(rated_at) FROM ratings)                AS last_rating`)
    .get() as Record<string, unknown>;
  res.json({ ...row, meta: meta() });
});

analyticsRouter.get('/analytics/ratings', (req, res) => {
  const db = getDb();
  const { where, params } = scope(req);
  const join = `FROM ratings r JOIN wines w ON w.id = r.wine_id ${where}`;

  res.json({
    distribution: db.prepare(`SELECT r.rating AS bucket, COUNT(*) AS n ${join} GROUP BY bucket ORDER BY bucket`).all(...params),
    timeline: db
      .prepare(`SELECT r.ym, COUNT(*) AS n, AVG(r.rating) AS avg ${join} ${where ? 'AND' : 'WHERE'} r.ym IS NOT NULL
                GROUP BY r.ym HAVING n >= 5 ORDER BY r.ym`)
      .all(...params),
    vintages: db
      .prepare(`SELECT r.vintage, COUNT(*) AS n, AVG(r.rating) AS avg ${join}
                ${where ? 'AND' : 'WHERE'} r.vintage BETWEEN 1960 AND 2022
                GROUP BY r.vintage HAVING n >= 30 ORDER BY r.vintage`)
      .all(...params),
    byType: db
      .prepare(`SELECT w.type, COUNT(*) AS n, AVG(r.rating) AS avg ${join} GROUP BY w.type ORDER BY n DESC`)
      .all(...params),
  });
});

analyticsRouter.get('/analytics/styles', (req, res) => {
  const db = getDb();
  const { where, params } = scope(req);

  res.json({
    types: db
      .prepare(`SELECT w.type, COUNT(*) AS wines, SUM(w.rating_count) AS ratings,
                       AVG(w.rating_score) AS score, AVG(w.abv) AS abv
                FROM wines w ${where} GROUP BY w.type ORDER BY wines DESC`)
      .all(...params),
    bodyAcidity: db
      .prepare(`SELECT w.body, w.acidity, COUNT(*) AS wines, SUM(w.rating_count) AS ratings,
                       AVG(w.rating_score) AS score
                FROM wines w ${where} ${where ? 'AND' : 'WHERE'} w.body <> '' AND w.acidity <> ''
                GROUP BY w.body, w.acidity`)
      .all(...params),
    abv: db
      .prepare(`SELECT w.type, CAST(w.abv AS INT) AS bucket, COUNT(*) AS n
                FROM wines w ${where} ${where ? 'AND' : 'WHERE'} w.abv IS NOT NULL
                GROUP BY w.type, bucket ORDER BY bucket`)
      .all(...params),
    elaborate: db
      .prepare(`SELECT CASE WHEN w.elaborate LIKE 'Varietal%' THEN 'Single grape' ELSE 'Blend' END AS kind,
                       COUNT(*) AS wines, AVG(w.rating_score) AS score
                FROM wines w ${where} GROUP BY kind`)
      .all(...params),
  });
});

analyticsRouter.get('/analytics/geography', (req, res) => {
  const db = getDb();
  const minWines = int(req.query.minWines, 5)!;
  res.json({
    countries: db
      .prepare(`SELECT code, name, wine_count, region_count, winery_count, rating_count,
                       rating_avg, rating_score, abv_avg, top_grape, top_type, critic_n, critic_points, critic_price
                FROM countries ORDER BY wine_count DESC`)
      .all(),
    regions: db
      .prepare(`SELECT id, name, country, country_code, wine_count, rating_count, rating_avg, rating_score, top_grape, top_type
                FROM regions WHERE wine_count >= ? AND rating_count > 0
                ORDER BY rating_score DESC LIMIT 25`)
      .all(minWines),
    wineries: db
      .prepare(`SELECT id, name, country, region, wine_count, rating_count, rating_avg, rating_score
                FROM wineries WHERE rating_count >= 50 ORDER BY rating_score DESC LIMIT 25`)
      .all(),
  });
});

analyticsRouter.get('/analytics/grapes', (req, res) => {
  const db = getDb();
  const limit = int(req.query.limit, 24)!;
  res.json({
    grapes: db
      .prepare(`SELECT name, wine_count, varietal_count, rating_count, rating_avg, abv_avg,
                       top_type, top_country, top_body, top_acidity, critic_n, critic_points, critic_price
                FROM grapes WHERE rating_count > 0 ORDER BY wine_count DESC LIMIT ?`)
      .all(limit),
    rated: db
      .prepare(`SELECT name, wine_count, rating_count, rating_avg FROM grapes
                WHERE rating_count >= 500 ORDER BY rating_avg DESC LIMIT 15`)
      .all(),
  });
});

/**
 * The money panel: what the critics charge for a point, which grapes and
 * countries over-deliver, and how price is distributed at all.
 */
analyticsRouter.get('/analytics/market', (req, res) => {
  const db = getDb();
  const country = str(req.query.criticCountry);
  const where = country ? 'WHERE price IS NOT NULL AND country = ?' : 'WHERE price IS NOT NULL';
  const params = country ? [country] : [];

  res.json({
    priceByPoints: db
      .prepare(`SELECT points, COUNT(*) AS n, AVG(price) AS avg_price,
                       MIN(price) AS min_price, MAX(price) AS max_price
                FROM critic_reviews ${where} GROUP BY points HAVING n >= 20 ORDER BY points`)
      .all(...params),
    priceHistogram: db
      .prepare(`SELECT CASE WHEN price < 100 THEN CAST(price / 5 AS INT) * 5 ELSE 100 END AS bucket,
                       COUNT(*) AS n, AVG(points) AS avg_points
                FROM critic_reviews ${where} GROUP BY bucket ORDER BY bucket`)
      .all(...params),
    valueByGrape: db
      .prepare(`SELECT c.key AS name, c.n, c.points_avg, c.price_med, c.price_p10, c.price_p90,
                       ROUND(c.points_avg / c.price_med, 3) AS points_per_unit
                FROM critic_stats c WHERE c.scope = 'grape' AND c.n >= 300 AND c.price_med > 0
                ORDER BY points_per_unit DESC LIMIT 15`)
      .all(),
    valueByCountry: db
      .prepare(`SELECT c.key AS name, c.n, c.points_avg, c.price_med,
                       ROUND(c.points_avg / c.price_med, 3) AS points_per_unit
                FROM critic_stats c WHERE c.scope = 'country' AND c.n >= 200 AND c.price_med > 0
                ORDER BY points_per_unit DESC LIMIT 15`)
      .all(),
    bargains: db
      .prepare(`SELECT id, title, variety, country, province, points, price, value, description
                FROM critic_reviews WHERE points >= 90 AND price IS NOT NULL AND price <= 25
                ORDER BY value DESC LIMIT 12`)
      .all(),
    priciest: db
      .prepare(`SELECT id, title, variety, country, points, price FROM critic_reviews
                WHERE price IS NOT NULL ORDER BY price DESC LIMIT 10`)
      .all(),
  });
});

analyticsRouter.get('/analytics/flavours', (req, res) => {
  const db = getDb();
  const grape = str(req.query.grape);
  res.json({
    global: db
      .prepare("SELECT word, family, n, share FROM descriptors WHERE scope = 'global' ORDER BY n DESC LIMIT 60")
      .all(),
    grape: grape
      ? db
          .prepare(`SELECT word, family, n, share, lift FROM descriptors WHERE scope = 'grape' AND key = ?
                    ORDER BY lift DESC LIMIT 24`)
          .all(grape)
      : [],
    grapeOptions: db
      .prepare(`SELECT DISTINCT key FROM descriptors WHERE scope = 'grape' ORDER BY key`)
      .all()
      .map((r) => (r as { key: string }).key),
  });
});
