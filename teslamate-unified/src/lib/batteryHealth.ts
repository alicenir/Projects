import type { Charge } from "@/api/schemas";

export interface RegressionPoint {
  x: number;
  y: number;
}

export interface RegressionLine {
  slope: number;
  intercept: number;
  predict: (x: number) => number;
}

/** Ordinary least squares — good enough for a "trending down/up" line, not a scientific fit. */
export function linearRegression(points: RegressionPoint[]): RegressionLine | null {
  const n = points.length;
  if (n < 2) return null;

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept, predict: (x) => slope * x + intercept };
}

export interface RangeAt100Point {
  date: string;
  timestamp: number;
  rangeAt100: number;
}

/**
 * Estimates rated range "as new" (i.e. at 100% SoC) from near-full charge
 * sessions, extrapolating linearly from wherever the session actually
 * ended. Restricted to sessions ending >=90% SoC to keep the extrapolation
 * reasonably tight — a session that stopped at 50% would extrapolate very
 * noisily.
 */
export function computeRangeAt100(charges: Charge[]): RangeAt100Point[] {
  return charges
    .filter((c) => c.battery_details.end_battery_level >= 90 && c.range_rated.end_range > 0)
    .map((c) => ({
      date: c.end_date,
      timestamp: new Date(c.end_date).getTime(),
      rangeAt100: (c.range_rated.end_range * 100) / c.battery_details.end_battery_level,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export interface CareStats {
  approxCycles: number | null;
  avgSessionStartSoc: number;
  avgSessionEndSoc: number;
  pctSessionsAbove95: number;
  pctSessionsBelow20Start: number;
  careScore: number;
}

/**
 * "Care" heuristics built entirely from charge-session start/end SoC — the
 * API has no continuous state-of-charge log, so this can't see time spent
 * parked at a given level, only how sessions began and ended. Treat the
 * score as a gentle nudge, not a real diagnostic.
 */
export function computeCareStats(charges: Charge[], currentCapacityKwh: number | null): CareStats {
  if (charges.length === 0) {
    return { approxCycles: null, avgSessionStartSoc: 0, avgSessionEndSoc: 0, pctSessionsAbove95: 0, pctSessionsBelow20Start: 0, careScore: 100 };
  }

  const totalEnergyAdded = charges.reduce((s, c) => s + c.charge_energy_added, 0);
  const avgSessionStartSoc = charges.reduce((s, c) => s + c.battery_details.start_battery_level, 0) / charges.length;
  const avgSessionEndSoc = charges.reduce((s, c) => s + c.battery_details.end_battery_level, 0) / charges.length;
  const pctSessionsAbove95 = (charges.filter((c) => c.battery_details.end_battery_level > 95).length / charges.length) * 100;
  const pctSessionsBelow20Start = (charges.filter((c) => c.battery_details.start_battery_level < 20).length / charges.length) * 100;

  // Softer penalty the less often it happens; both maxed at ~40 points combined.
  const careScore = Math.round(Math.max(0, 100 - pctSessionsAbove95 * 0.4 - pctSessionsBelow20Start * 0.3));

  return {
    approxCycles: currentCapacityKwh ? totalEnergyAdded / currentCapacityKwh : null,
    avgSessionStartSoc,
    avgSessionEndSoc,
    pctSessionsAbove95,
    pctSessionsBelow20Start,
    careScore,
  };
}
