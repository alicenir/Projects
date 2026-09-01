import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getSecurityStatus, runScan } from "../services/cve.js";

export const securityRouter = Router();

securityRouter.get("/status", async (_req, res) => {
  res.json(await getSecurityStatus());
});

/**
 * Kicks off a full re-scan and returns immediately — a sweep can take a minute
 * or two under NVD's anonymous rate limit, which is far longer than a browser
 * request should wait. The widget polls /status for the result.
 */
securityRouter.post("/refresh", requireAuth, async (_req, res) => {
  void runScan(true);
  res.json({ ok: true, scanning: true });
});
