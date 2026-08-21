import { Router } from "express";
import { z } from "zod";
import { fetchArt, getActivity } from "../services/tautulli.js";

export const tautulliRouter = Router();

tautulliRouter.get("/activity", async (_req, res) => {
  res.json(await getActivity());
});

tautulliRouter.get("/art", async (req, res) => {
  const parsed = z
    .object({ thumb: z.string().startsWith("/library/") })
    .safeParse({ thumb: String(req.query.thumb ?? "") });
  if (!parsed.success) return res.status(400).json({ error: "Invalid art request" });

  const art = await fetchArt(parsed.data.thumb);
  if (!art) return res.status(404).json({ error: "Art not available" });
  res.setHeader("Content-Type", art.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(Buffer.from(art.body));
});
