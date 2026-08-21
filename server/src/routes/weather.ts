import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { geocode, getWeather } from "../services/weather.js";

export const weatherRouter = Router();

weatherRouter.get("/", async (_req, res) => {
  res.json(await getWeather());
});

weatherRouter.get("/search", requireAuth, async (req, res) => {
  const parsed = z.object({ q: z.string().min(2) }).safeParse({ q: req.query.q });
  if (!parsed.success) return res.status(400).json({ error: "q is required" });
  try {
    res.json({ results: await geocode(parsed.data.q) });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Lookup failed" });
  }
});
