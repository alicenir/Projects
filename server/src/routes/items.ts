import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const itemsRouter = Router();

itemsRouter.get("/categories", (_req, res) => {
  const categories = db
    .prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC")
    .all();
  res.json(categories);
});

const categorySchema = z.object({ name: z.string().min(1), sort_order: z.number().optional() });

itemsRouter.post("/categories", requireAuth, (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid category" });
  const info = db
    .prepare("INSERT INTO categories (name, sort_order) VALUES (?, ?)")
    .run(parsed.data.name, parsed.data.sort_order ?? 0);
  res.json({ id: info.lastInsertRowid });
});

itemsRouter.put("/categories/:id", requireAuth, (req, res) => {
  const parsed = categorySchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid category" });
  const existing = db.prepare("SELECT * FROM categories WHERE id = ?").get(req.params.id) as
    | { name: string; sort_order: number }
    | undefined;
  if (!existing) return res.status(404).json({ error: "Not found" });
  db.prepare("UPDATE categories SET name = ?, sort_order = ? WHERE id = ?").run(
    parsed.data.name ?? existing.name,
    parsed.data.sort_order ?? existing.sort_order,
    req.params.id
  );
  res.json({ ok: true });
});

itemsRouter.delete("/categories/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

itemsRouter.get("/items", (_req, res) => {
  const items = db.prepare("SELECT * FROM items ORDER BY sort_order ASC, id ASC").all();
  res.json(items);
});

const itemSchema = z.object({
  type: z.enum(["app", "bookmark"]),
  name: z.string().min(1),
  url: z.string().min(1),
  icon: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category_id: z.number().optional().nullable(),
  sort_order: z.number().optional(),
  is_pinned: z.boolean().optional(),
});

itemsRouter.post("/items", requireAuth, (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid item", details: parsed.error.flatten() });
  const d = parsed.data;
  const info = db
    .prepare(
      `INSERT INTO items (type, name, url, icon, description, category_id, sort_order, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      d.type,
      d.name,
      d.url,
      d.icon ?? null,
      d.description ?? null,
      d.category_id ?? null,
      d.sort_order ?? 0,
      d.is_pinned ? 1 : 0
    );
  res.json({ id: info.lastInsertRowid });
});

itemsRouter.put("/items/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM items WHERE id = ?").get(req.params.id) as
    | Record<string, any>
    | undefined;
  if (!existing) return res.status(404).json({ error: "Not found" });

  const parsed = itemSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid item" });
  const d = parsed.data;

  db.prepare(
    `UPDATE items SET type = ?, name = ?, url = ?, icon = ?, description = ?, category_id = ?, sort_order = ?, is_pinned = ?
     WHERE id = ?`
  ).run(
    d.type ?? existing.type,
    d.name ?? existing.name,
    d.url ?? existing.url,
    d.icon !== undefined ? d.icon : existing.icon,
    d.description !== undefined ? d.description : existing.description,
    d.category_id !== undefined ? d.category_id : existing.category_id,
    d.sort_order !== undefined ? d.sort_order : existing.sort_order,
    d.is_pinned !== undefined ? (d.is_pinned ? 1 : 0) : existing.is_pinned,
    req.params.id
  );
  res.json({ ok: true });
});

itemsRouter.delete("/items/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.number(), sort_order: z.number() })),
});

itemsRouter.post("/items/reorder", requireAuth, (req, res) => {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const update = db.prepare("UPDATE items SET sort_order = ? WHERE id = ?");
  const tx = db.transaction((rows: { id: number; sort_order: number }[]) => {
    for (const row of rows) update.run(row.sort_order, row.id);
  });
  tx(parsed.data.items);
  res.json({ ok: true });
});
