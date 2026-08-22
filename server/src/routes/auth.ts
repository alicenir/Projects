import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getSetting, setSetting } from "../db.js";
import { COOKIE_NAME, isRequestAuthed, requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.get("/status", (req, res) => {
  res.json({
    hasPassword: Boolean(getSetting("password_hash")),
    authed: isRequestAuthed(req),
  });
});

const loginSchema = z.object({ password: z.string().min(1) });

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Password required" });

  const hash = getSetting("password_hash");
  if (!hash) return res.status(400).json({ error: "No password configured" });

  const ok = bcrypt.compareSync(parsed.data.password, hash);
  if (!ok) return res.status(401).json({ error: "Incorrect password" });

  const token = signToken();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ token });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

const setPasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(4),
});

authRouter.post("/set-password", requireAuth, (req, res) => {
  const parsed = setPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Password must be at least 4 characters" });

  const existingHash = getSetting("password_hash");
  if (existingHash) {
    const provided = parsed.data.currentPassword ?? "";
    if (!bcrypt.compareSync(provided, existingHash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
  }

  const hash = bcrypt.hashSync(parsed.data.newPassword, 10);
  setSetting("password_hash", hash);
  res.json({ ok: true });
});
