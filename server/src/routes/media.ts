import { Router } from "express";
import { z } from "zod";
import { type ArrService, fetchCover, getRecentMedia } from "../services/arr.js";

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
