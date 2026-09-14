import { Router } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { int } from '../lib/params.js';

export const cellarRouter = Router();

const bottleSchema = z.object({
  wine_id: z.number().int().positive(),
  vintage: z.number().int().min(1800).max(2100).nullable().optional(),
  quantity: z.number().int().min(0).max(9999).default(1),
  price_paid: z.number().min(0).nullable().optional(),
  currency: z.string().max(8).default('EUR'),
  purchased_on: z.string().max(20).nullable().optional(),
  drink_from: z.number().int().min(1800).max(2200).nullable().optional(),
  drink_to: z.number().int().min(1800).max(2200).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const noteSchema = z.object({
  wine_id: z.number().int().positive(),
  vintage: z.number().int().min(1800).max(2100).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  tasted_on: z.string().max(20).optional(),
});

const WINE_JOIN = `
  SELECT b.*, w.name, w.winery, w.type, w.country, w.country_code, w.region, w.grapes,
         w.rating_avg, w.rating_count
  FROM cellar.cellar_bottles b JOIN wines w ON w.id = b.wine_id`;

cellarRouter.get('/cellar', (_req, res) => {
  const db = getDb();
  const bottles = (db.prepare(`${WINE_JOIN} ORDER BY b.created_at DESC`).all() as Record<string, unknown>[]).map((b) => ({
    ...b,
    grapes: JSON.parse(String(b.grapes ?? '[]')),
  }));

  const summary = db
    .prepare(`
      SELECT COUNT(*) AS entries, COALESCE(SUM(b.quantity), 0) AS bottles,
             COALESCE(SUM(b.quantity * COALESCE(b.price_paid, 0)), 0) AS spend,
             COUNT(DISTINCT w.country_code) AS countries
      FROM cellar.cellar_bottles b JOIN wines w ON w.id = b.wine_id`)
    .get();

  res.json({
    bottles,
    summary,
    byType: db
      .prepare(`SELECT w.type, SUM(b.quantity) AS bottles FROM cellar.cellar_bottles b
                JOIN wines w ON w.id = b.wine_id GROUP BY w.type ORDER BY bottles DESC`)
      .all(),
    byCountry: db
      .prepare(`SELECT w.country, w.country_code, SUM(b.quantity) AS bottles FROM cellar.cellar_bottles b
                JOIN wines w ON w.id = b.wine_id GROUP BY w.country_code ORDER BY bottles DESC`)
      .all(),
    drinkingWindow: db
      .prepare(`SELECT b.drink_from, b.drink_to, SUM(b.quantity) AS bottles FROM cellar.cellar_bottles b
                WHERE b.drink_to IS NOT NULL GROUP BY b.drink_from, b.drink_to ORDER BY b.drink_to`)
      .all(),
  });
});

cellarRouter.post('/cellar', (req, res) => {
  const parsed = bottleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid bottle' });
    return;
  }
  const b = parsed.data;
  const db = getDb();
  if (!db.prepare('SELECT 1 AS x FROM wines WHERE id = ?').get(b.wine_id)) {
    res.status(404).json({ error: 'wine not found' });
    return;
  }
  const info = db
    .prepare(`INSERT INTO cellar.cellar_bottles
      (wine_id, vintage, quantity, price_paid, currency, purchased_on, drink_from, drink_to, location, notes)
      VALUES (@wine_id, @vintage, @quantity, @price_paid, @currency, @purchased_on, @drink_from, @drink_to, @location, @notes)`)
    .run({
      wine_id: b.wine_id,
      vintage: b.vintage ?? null,
      quantity: b.quantity,
      price_paid: b.price_paid ?? null,
      currency: b.currency,
      purchased_on: b.purchased_on ?? null,
      drink_from: b.drink_from ?? null,
      drink_to: b.drink_to ?? null,
      location: b.location ?? null,
      notes: b.notes ?? null,
    });
  res.status(201).json(db.prepare('SELECT * FROM cellar.cellar_bottles WHERE id = ?').get(info.lastInsertRowid));
});

cellarRouter.patch('/cellar/:id', (req, res) => {
  const db = getDb();
  const id = int(req.params.id);
  const existing = db.prepare('SELECT * FROM cellar.cellar_bottles WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'bottle not found' });
    return;
  }
  const parsed = bottleSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid bottle' });
    return;
  }
  const merged = { ...existing, ...parsed.data, id };
  db.prepare(`UPDATE cellar.cellar_bottles SET
      vintage = @vintage, quantity = @quantity, price_paid = @price_paid, currency = @currency,
      purchased_on = @purchased_on, drink_from = @drink_from, drink_to = @drink_to,
      location = @location, notes = @notes
      WHERE id = @id`).run(merged as never);
  res.json(db.prepare('SELECT * FROM cellar.cellar_bottles WHERE id = ?').get(id));
});

cellarRouter.delete('/cellar/:id', (req, res) => {
  getDb().prepare('DELETE FROM cellar.cellar_bottles WHERE id = ?').run(int(req.params.id));
  res.status(204).end();
});

/** The tasting journal: what it tasted like, and what you scored it. */
cellarRouter.get('/notes', (_req, res) => {
  const db = getDb();
  res.json({
    notes: (db
      .prepare(`SELECT n.*, w.name, w.winery, w.type, w.country, w.grapes FROM cellar.tasting_notes n
                JOIN wines w ON w.id = n.wine_id ORDER BY n.tasted_on DESC, n.id DESC`)
      .all() as Record<string, unknown>[]).map((n) => ({ ...n, grapes: JSON.parse(String(n.grapes ?? '[]')) })),
    summary: db
      .prepare(`SELECT COUNT(*) AS tastings, AVG(rating) AS avg_rating, COUNT(DISTINCT wine_id) AS wines
                FROM cellar.tasting_notes`)
      .get(),
    byGrape: db
      .prepare(`SELECT g.grape AS name, COUNT(*) AS tastings, AVG(n.rating) AS avg_rating
                FROM cellar.tasting_notes n JOIN wine_grapes g ON g.wine_id = n.wine_id
                GROUP BY g.grape ORDER BY tastings DESC LIMIT 12`)
      .all(),
  });
});

cellarRouter.post('/notes', (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid note' });
    return;
  }
  const n = parsed.data;
  const db = getDb();
  if (!db.prepare('SELECT 1 AS x FROM wines WHERE id = ?').get(n.wine_id)) {
    res.status(404).json({ error: 'wine not found' });
    return;
  }
  const info = db
    .prepare(`INSERT INTO cellar.tasting_notes (wine_id, vintage, rating, notes, tasted_on)
              VALUES (?, ?, ?, ?, COALESCE(?, date('now')))`)
    .run(n.wine_id, n.vintage ?? null, n.rating ?? null, n.notes ?? null, n.tasted_on ?? null);
  res.status(201).json(db.prepare('SELECT * FROM cellar.tasting_notes WHERE id = ?').get(info.lastInsertRowid));
});

cellarRouter.delete('/notes/:id', (req, res) => {
  getDb().prepare('DELETE FROM cellar.tasting_notes WHERE id = ?').run(int(req.params.id));
  res.status(204).end();
});

cellarRouter.get('/wishlist', (_req, res) => {
  const db = getDb();
  res.json(
    (db
      .prepare(`SELECT wl.*, w.name, w.winery, w.type, w.country, w.grapes, w.rating_avg, w.rating_count
                FROM cellar.wishlist wl JOIN wines w ON w.id = wl.wine_id ORDER BY wl.created_at DESC`)
      .all() as Record<string, unknown>[]).map((r) => ({ ...r, grapes: JSON.parse(String(r.grapes ?? '[]')) })),
  );
});

cellarRouter.put('/wishlist/:id', (req, res) => {
  const db = getDb();
  const id = int(req.params.id);
  if (!db.prepare('SELECT 1 AS x FROM wines WHERE id = ?').get(id)) {
    res.status(404).json({ error: 'wine not found' });
    return;
  }
  db.prepare('INSERT OR REPLACE INTO cellar.wishlist (wine_id, note) VALUES (?, ?)').run(id, String(req.body?.note ?? '') || null);
  res.status(201).json({ wine_id: id });
});

cellarRouter.delete('/wishlist/:id', (req, res) => {
  getDb().prepare('DELETE FROM cellar.wishlist WHERE wine_id = ?').run(int(req.params.id));
  res.status(204).end();
});

cellarRouter.get('/profile', (_req, res) => {
  const row = getDb().prepare('SELECT profile, updated_at FROM cellar.taste_profile WHERE id = 1').get() as
    | { profile: string; updated_at: string }
    | undefined;
  res.json(row ? { profile: JSON.parse(row.profile), updated_at: row.updated_at } : { profile: null });
});

cellarRouter.put('/profile', (req, res) => {
  const profile = req.body ?? {};
  getDb()
    .prepare(`INSERT INTO cellar.taste_profile (id, profile, updated_at) VALUES (1, ?, datetime('now'))
              ON CONFLICT(id) DO UPDATE SET profile = excluded.profile, updated_at = excluded.updated_at`)
    .run(JSON.stringify(profile));
  res.json({ profile });
});

/** Take your cellar with you: one CSV, no lock-in. */
cellarRouter.get('/cellar/export.csv', (_req, res) => {
  const rows = getDb()
    .prepare(`SELECT w.name, w.winery, w.country, w.region, b.vintage, b.quantity, b.price_paid, b.currency,
                     b.purchased_on, b.drink_from, b.drink_to, b.location, b.notes
              FROM cellar.cellar_bottles b JOIN wines w ON w.id = b.wine_id ORDER BY w.winery, w.name`)
    .all() as Record<string, unknown>[];
  const header = ['wine', 'winery', 'country', 'region', 'vintage', 'quantity', 'price_paid', 'currency',
    'purchased_on', 'drink_from', 'drink_to', 'location', 'notes'];
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [header.join(','), ...rows.map((r) => Object.values(r).map(escape).join(','))].join('\n');
  res.setHeader('content-type', 'text/csv; charset=utf-8');
  res.setHeader('content-disposition', 'attachment; filename="cellar.csv"');
  res.send(csv);
});
