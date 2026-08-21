import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  type ArrService,
  addMedia,
  fetchCover,
  getAddOptions,
  getRecentMedia,
  lookup,
} from "../services/arr.js";

export const mediaRouter = Router();

mediaRouter.get("/recent", async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 40);
  const snapshot = await getRecentMedia(limit);
  res.json(snapshot);
});

const coverSchema = z.object({
  service: z.enum(["sonarr", "radarr"]),
  path: z.string().startsWith("/MediaCover/"),
});

mediaRouter.get("/cover/:service", async (req, res) => {
  const parsed = coverSchema.safeParse({
    service: req.params.service,
    path: String(req.query.path ?? ""),
  });
  if (!parsed.success) return res.status(400).json({ error: "Invalid cover request" });

  const cover = await fetchCover(parsed.data.service as ArrService, parsed.data.path);
  if (!cover) return res.status(404).json({ error: "Cover not available" });

  res.setHeader("Content-Type", cover.contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(Buffer.from(cover.body));
});

// --- Adding new media -------------------------------------------------------
// All of these are privileged: they read your library and can queue downloads,
// so they sit behind the same auth gate as editing.

const serviceSchema = z.enum(["sonarr", "radarr"]);

mediaRouter.get("/search", requireAuth, async (req, res) => {
  const parsed = z
    .object({ service: serviceSchema, q: z.string().min(1) })
    .safeParse({ service: req.query.service, q: req.query.q });
  if (!parsed.success) return res.status(400).json({ error: "service and q are required" });

  try {
    res.json({ results: await lookup(parsed.data.service, parsed.data.q) });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Lookup failed" });
  }
});

mediaRouter.get("/options/:service", requireAuth, async (req, res) => {
  const parsed = serviceSchema.safeParse(req.params.service);
  if (!parsed.success) return res.status(400).json({ error: "Unknown service" });

  try {
    res.json(await getAddOptions(parsed.data));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Could not load options" });
  }
});

const addSchema = z.object({
  service: serviceSchema,
  externalId: z.number().int().positive(),
  title: z.string().min(1),
  year: z.number().int().nullable().optional(),
  qualityProfileId: z.number().int(),
  rootFolderPath: z.string().min(1),
  searchNow: z.boolean().default(true),
  monitor: z.enum(["all", "future", "firstSeason", "none"]).optional(),
});

mediaRouter.post("/add", requireAuth, async (req, res) => {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  try {
    res.json(await addMedia(parsed.data));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Could not add" });
  }
});
