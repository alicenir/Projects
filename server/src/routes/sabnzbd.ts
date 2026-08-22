import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import {
  deleteJob,
  getSnapshot,
  pauseJob,
  pauseQueue,
  resumeJob,
  resumeQueue,
} from "../services/sabnzbd.js";

export const sabnzbdRouter = Router();

sabnzbdRouter.get("/status", async (_req, res) => {
  res.json(await getSnapshot());
});

sabnzbdRouter.post("/pause", requireAuth, async (_req, res) => {
  await pauseQueue();
  res.json({ ok: true });
});

sabnzbdRouter.post("/resume", requireAuth, async (_req, res) => {
  await resumeQueue();
  res.json({ ok: true });
});

const jobSchema = z.object({ nzoId: z.string().min(1) });

sabnzbdRouter.post("/jobs/:nzoId/pause", requireAuth, async (req, res) => {
  const parsed = jobSchema.safeParse({ nzoId: req.params.nzoId });
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id" });
  await pauseJob(parsed.data.nzoId);
  res.json({ ok: true });
});

sabnzbdRouter.post("/jobs/:nzoId/resume", requireAuth, async (req, res) => {
  const parsed = jobSchema.safeParse({ nzoId: req.params.nzoId });
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id" });
  await resumeJob(parsed.data.nzoId);
  res.json({ ok: true });
});

sabnzbdRouter.delete("/jobs/:nzoId", requireAuth, async (req, res) => {
  const parsed = jobSchema.safeParse({ nzoId: req.params.nzoId });
  if (!parsed.success) return res.status(400).json({ error: "Invalid job id" });
  await deleteJob(parsed.data.nzoId);
  res.json({ ok: true });
});
