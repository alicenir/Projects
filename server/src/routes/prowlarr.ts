import { Router } from "express";
import { getStatus } from "../services/prowlarr.js";

export const prowlarrRouter = Router();

prowlarrRouter.get("/status", async (_req, res) => {
  res.json(await getStatus());
});
