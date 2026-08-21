import { Router } from "express";
import { checkAll, snapshot } from "../services/health.js";
import { requireAuth } from "../middleware/auth.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json(snapshot());
});

healthRouter.post("/check", requireAuth, async (_req, res) => {
  res.json(await checkAll());
});
