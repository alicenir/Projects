import type { Request } from 'express';

/** Query arrays arrive either repeated (?type=Red&type=White) or comma-joined. */
export function list(req: Request, key: string): string[] | undefined {
  const raw = req.query[key];
  if (raw === undefined) return undefined;
  const values = (Array.isArray(raw) ? raw : [raw])
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  return values.length ? values : undefined;
}

export function numbers(req: Request, key: string): number[] | undefined {
  const values = list(req, key);
  if (!values) return undefined;
  const nums = values.map(Number).filter((n) => Number.isFinite(n));
  return nums.length ? nums : undefined;
}

export function int(value: unknown, fallback?: number): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function float(value: unknown, fallback?: number): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function str(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}
