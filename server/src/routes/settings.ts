import { Router } from "express";
import { z } from "zod";
import { getAllSettings, setSetting } from "../db.js";
import { isRequestAuthed, requireAuth } from "../middleware/auth.js";
import { testConnection } from "../services/sabnzbd.js";

export const settingsRouter = Router();

const SECRET_KEYS = ["password_hash", "sabnzbd_api_key"];

settingsRouter.get("/", (req, res) => {
  const all = getAllSettings();
  const authed = isRequestAuthed(req);
  const visible = Object.fromEntries(
    Object.entries(all).filter(([key]) => !SECRET_KEYS.includes(key))
  );
  // Only reveal whether sabnzbd is configured, never the raw key, unless editing.
  visible.sabnzbd_configured = String(Boolean(all.sabnzbd_url && all.sabnzbd_api_key));
  if (!authed) {
    delete visible.sabnzbd_url;
  }
  res.json(visible);
});

const updateSchema = z.record(z.string(), z.string());

settingsRouter.put("/", requireAuth, (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid settings payload" });
  for (const [key, value] of Object.entries(parsed.data)) {
    if (key === "password_hash") continue; // password changes go through /api/auth/set-password
    setSetting(key, value);
  }
  res.json({ ok: true });
});

const testSchema = z.object({ url: z.string().min(1), apiKey: z.string().min(1) });

settingsRouter.post("/sabnzbd/test", requireAuth, async (req, res) => {
  const parsed = testSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "URL and API key required" });
  const result = await testConnection(parsed.data.url, parsed.data.apiKey);
  res.json(result);
});
