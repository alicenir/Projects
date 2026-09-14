import { Router } from 'express';
import { getDb } from '../db.js';
import { CARD_COLUMNS, hydrate } from '../lib/wineQuery.js';
import type { WineCard } from '../lib/wineQuery.js';
import { int, str } from '../lib/params.js';

export const discoverRouter = Router();

export type TasteProfile = {
  types?: string[];
  bodies?: string[];
  acidities?: string[];
  grapes?: string[];
  countries?: string[];
  pairings?: string[];
  abvMax?: number | null;
  adventurous?: number; // 0 = give me the classics, 1 = surprise me
};

type Scored = WineCard & { match: number; reasons: string[] };

/**
 * Rank the catalogue against a taste profile. Ratings decide most of it; the
 * profile tilts the list and, crucially, explains itself — a recommendation a
 * drinker cannot interrogate is just noise.
 */
function scoreAgainstProfile(candidates: WineCard[], profile: TasteProfile, globalAvg: number): Scored[] {
  const adventurous = Math.min(1, Math.max(0, profile.adventurous ?? 0.3));
  const wanted = {
    types: new Set(profile.types ?? []),
    bodies: new Set(profile.bodies ?? []),
    acidities: new Set(profile.acidities ?? []),
    grapes: new Set(profile.grapes ?? []),
    countries: new Set(profile.countries ?? []),
    pairings: new Set(profile.pairings ?? []),
  };
  const maxRatings = Math.max(1, ...candidates.map((c) => c.rating_count));

  return candidates
    .map((wine) => {
      const reasons: string[] = [];
      let score = 0;

      const quality = ((wine.rating_score ?? globalAvg) - 3) / 2; // ~0..1 over the useful range
      score += 0.45 * Math.max(0, Math.min(1, quality));

      const grapeHit = wine.grapes.filter((g) => wanted.grapes.has(g));
      if (grapeHit.length) {
        score += 0.2;
        reasons.push(`made from ${grapeHit.join(' & ')}`);
      }
      if (wanted.types.has(wine.type)) {
        score += 0.12;
        reasons.push(`${wine.type.toLowerCase()} wine`);
      }
      if (wanted.bodies.has(wine.body)) {
        score += 0.06;
        reasons.push(wine.body.toLowerCase());
      }
      if (wanted.acidities.has(wine.acidity)) {
        score += 0.04;
        reasons.push(`${wine.acidity.toLowerCase()} acidity`);
      }
      if (wanted.countries.has(wine.country_code)) {
        score += 0.08;
        reasons.push(`from ${wine.country}`);
      }
      const pairingHit = wine.pairings.filter((p) => wanted.pairings.has(p));
      if (pairingHit.length) {
        score += 0.05 * Math.min(2, pairingHit.length);
        reasons.push(`pairs with ${pairingHit.slice(0, 2).join(' and ').toLowerCase()}`);
      }
      if (profile.abvMax && wine.abv !== null && wine.abv <= profile.abvMax) {
        score += 0.03;
        reasons.push(`${wine.abv}% ABV`);
      }

      // Familiarity: popular bottles for the cautious, obscure ones for the curious.
      const popularity = wine.rating_count / maxRatings;
      score += (adventurous > 0.5 ? -1 : 1) * Math.abs(adventurous - 0.5) * 0.2 * popularity;
      if (adventurous > 0.7 && popularity < 0.1) reasons.push('off the beaten track');

      if (wine.rating_count >= 200 && (wine.rating_avg ?? 0) >= 4.3) reasons.unshift('a crowd favourite');
      return { ...wine, match: Math.round(Math.max(0, Math.min(1, score)) * 100), reasons: reasons.slice(0, 4) };
    })
    .sort((a, b) => b.match - a.match);
}

function candidatePool(limit = 600): WineCard[] {
  return getDb()
    .prepare(`SELECT ${CARD_COLUMNS} FROM wines w WHERE w.rating_count >= 10
              ORDER BY w.rating_score DESC NULLS LAST LIMIT ?`)
    .all(limit)
    .map((r) => hydrate(r as Record<string, unknown>));
}

function globalAverage(): number {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'global_rating_avg'").get() as { value: string } | undefined;
  return Number(row?.value ?? 3.8);
}

discoverRouter.post('/recommend', (req, res) => {
  const profile = (req.body ?? {}) as TasteProfile & { limit?: number };
  const limit = Math.min(48, Math.max(1, profile.limit ?? 12));
  const ranked = scoreAgainstProfile(candidatePool(), profile, globalAverage());
  res.json({ items: ranked.slice(0, limit) });
});

/**
 * Recommendations from what the user actually drank: the taste-neighbours of
 * every wine they rated 4+ or put in the cellar, minus the ones they already own.
 */
discoverRouter.get('/recommend/for-me', (_req, res) => {
  const db = getDb();
  const seeds = db
    .prepare(`SELECT wine_id, MAX(weight) AS weight FROM (
                SELECT wine_id, MAX(rating) AS weight FROM cellar.tasting_notes WHERE rating >= 4 GROUP BY wine_id
                UNION ALL
                SELECT wine_id, 4.0 AS weight FROM cellar.cellar_bottles
              ) GROUP BY wine_id`)
    .all() as { wine_id: number; weight: number }[];

  const stored = db.prepare('SELECT profile FROM cellar.taste_profile WHERE id = 1').get() as { profile: string } | undefined;
  const profile: TasteProfile = stored ? JSON.parse(stored.profile) : {};

  if (!seeds.length) {
    const ranked = scoreAgainstProfile(candidatePool(), profile, globalAverage());
    res.json({ basis: 'profile', seeds: [], items: ranked.slice(0, 12) });
    return;
  }

  const scores = new Map<number, { score: number; from: Set<number> }>();
  const owned = new Set(seeds.map((s) => s.wine_id));
  for (const seed of seeds) {
    const neighbours = db
      .prepare("SELECT other_id, score FROM wine_similar WHERE wine_id = ? AND kind = 'taste' ORDER BY score DESC LIMIT 10")
      .all(seed.wine_id) as { other_id: number; score: number }[];
    const fallback = neighbours.length
      ? neighbours
      : (db
          .prepare("SELECT other_id, score FROM wine_similar WHERE wine_id = ? AND kind = 'profile' ORDER BY score DESC LIMIT 6")
          .all(seed.wine_id) as { other_id: number; score: number }[]);
    for (const n of fallback) {
      if (owned.has(n.other_id)) continue;
      const cur = scores.get(n.other_id) ?? { score: 0, from: new Set<number>() };
      cur.score += n.score * (seed.weight / 5);
      cur.from.add(seed.wine_id);
      scores.set(n.other_id, cur);
    }
  }

  const ids = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 12);
  const items = ids.map(([id, info]) => {
    const wine = hydrate(db.prepare(`SELECT ${CARD_COLUMNS} FROM wines w WHERE w.id = ?`).get(id) as Record<string, unknown>);
    const sources = db
      .prepare(`SELECT name, winery FROM wines WHERE id IN (${[...info.from].map(() => '?').join(',')}) LIMIT 2`)
      .all(...info.from) as { name: string; winery: string }[];
    return {
      ...wine,
      match: Math.round(Math.min(1, info.score) * 100),
      reasons: sources.map((s) => `drinkers who liked ${s.winery} ${s.name} liked this`),
    };
  });

  res.json({ basis: 'cellar', seeds: seeds.map((s) => s.wine_id), items });
});

/** Quick picks for a meal tonight, by dish and wine type. */
discoverRouter.get('/discover/tonight', (req, res) => {
  const db = getDb();
  const pairing = str(req.query.pairing);
  const type = str(req.query.type);
  const clauses = ['w.rating_count >= 20'];
  const params: unknown[] = [];
  if (pairing) {
    clauses.push('EXISTS (SELECT 1 FROM wine_pairings p WHERE p.wine_id = w.id AND p.pairing = ?)');
    params.push(pairing);
  }
  if (type) {
    clauses.push('w.type = ?');
    params.push(type);
  }
  // Draw from the top of the ranking, then shuffle, so the shelf looks
  // different on every visit without ever recommending a poorly rated bottle.
  res.json(
    db
      .prepare(`SELECT * FROM (
                  SELECT ${CARD_COLUMNS} FROM wines w WHERE ${clauses.join(' AND ')}
                  ORDER BY w.rating_score DESC NULLS LAST LIMIT 60
                ) ORDER BY RANDOM() LIMIT 8`)
      .all(...params)
      .map((r) => hydrate(r as Record<string, unknown>)),
  );
});

/**
 * Blind tasting: a real Wine Enthusiast note with the grape (or country) filed
 * off, plus three plausible decoys drawn from varieties of the same colour.
 */
discoverRouter.get('/game/blind', (req, res) => {
  const db = getDb();
  const mode = str(req.query.mode) === 'country' ? 'country' : 'grape';
  const column = mode === 'country' ? 'country' : 'variety';

  const pool = db
    .prepare(`SELECT ${column} AS answer, COUNT(*) AS n FROM critic_reviews
              WHERE ${column} IS NOT NULL AND points >= 87 GROUP BY answer HAVING n >= 150 ORDER BY n DESC LIMIT 30`)
    .all() as { answer: string; n: number }[];
  if (pool.length < 4) {
    res.status(503).json({ error: 'not enough critic reviews for the tasting game' });
    return;
  }

  const answer = pool[Math.floor(Math.random() * pool.length)].answer;
  const review = db
    .prepare(`SELECT id, description, points, price, vintage, variety, country, province
              FROM critic_reviews WHERE ${column} = ? AND LENGTH(description) > 160 AND points >= 87
              ORDER BY RANDOM() LIMIT 1`)
    .get(answer) as Record<string, unknown> | undefined;
  if (!review) {
    res.status(503).json({ error: 'no suitable review found, try again' });
    return;
  }

  const decoys = pool
    .filter((p) => p.answer !== answer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((p) => p.answer);
  const options = [answer, ...decoys].sort(() => Math.random() - 0.5);

  // The grape and country are scrubbed from the note so the answer is not given away.
  const scrub = (text: string) => {
    let out = text;
    for (const term of [answer, String(review.variety ?? ''), String(review.country ?? ''), String(review.province ?? '')]) {
      if (term.length > 2) out = out.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '—');
    }
    return out;
  };

  res.json({
    mode,
    note: scrub(String(review.description ?? '')),
    points: review.points,
    price: review.price,
    vintage: review.vintage,
    options,
    answer,
  });
});

/** A flight of contrasting wines: same grape, different countries. */
discoverRouter.get('/discover/flight', (req, res) => {
  const db = getDb();
  const grape = str(req.query.grape);
  const limit = int(req.query.limit, 4)!;
  const chosen =
    grape ??
    ((db.prepare('SELECT name FROM grapes WHERE wine_count >= 20 ORDER BY RANDOM() LIMIT 1').get() as { name: string } | undefined)
      ?.name ?? 'Cabernet Sauvignon');

  const wines = db
    .prepare(`SELECT ${CARD_COLUMNS}, MAX(w.rating_score) AS best FROM wines w
              JOIN wine_grapes g ON g.wine_id = w.id AND g.grape = ?
              WHERE w.rating_count >= 20
              GROUP BY w.country_code
              ORDER BY best DESC LIMIT ?`)
    .all(chosen, limit)
    .map((r) => hydrate(r as Record<string, unknown>));

  res.json({ grape: chosen, wines });
});
