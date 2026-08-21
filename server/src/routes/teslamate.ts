import { Router } from "express";
import { getSnapshot } from "../services/teslamate.js";

export const teslamateRouter = Router();

teslamateRouter.get("/status", async (_req, res) => {
  res.json(await getSnapshot());
});
