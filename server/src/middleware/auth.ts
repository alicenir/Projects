import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getSetting } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";
const COOKIE_NAME = "homebase_token";

export interface AuthedRequest extends Request {
  isAuthed?: boolean;
}

export function signToken(): string {
  return jwt.sign({ scope: "edit" }, JWT_SECRET, { expiresIn: "30d" });
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = req.headers.cookie
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

export function isRequestAuthed(req: Request): boolean {
  // If no password has been set up yet, editing is open (first-run experience).
  const hash = getSetting("password_hash");
  if (!hash) return true;

  const token = extractToken(req);
  if (!token) return false;
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (isRequestAuthed(req)) {
    req.isAuthed = true;
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}

export { COOKIE_NAME };
