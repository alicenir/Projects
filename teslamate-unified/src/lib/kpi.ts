import { format } from "date-fns";
import type { Charge, Drive } from "@/api/schemas";

/**
 * Rough grid-average estimate (~0.2 kg CO2/km) of what an equivalent petrol
 * car would have emitted over the same distance — not a precise figure,
 * just a "roughly how much" sense, and labeled as an estimate wherever shown.
 */
const CO2_AVOIDED_KG_PER_KM = 0.2;

export interface KpiTotals {
  driveCount: number;
  totalDistance: number;
  energyConsumedKwh: number;
  totalChargeCost: number;
  avgEfficiencyWhPerKm: number | null;
  co2AvoidedKg: number;
  longestDrive: number;
  fastestChargeAvgKw: number | null;
}

export function computeKpiTotals(drives: Drive[], charges: Charge[]): KpiTotals {
  let totalDistance = 0;
  let energyConsumedKwh = 0;
  let effEnergyWh = 0;
  let effDistance = 0;
  let longestDrive = 0;

  for (const d of drives) {
    const distance = d.odometer_details.odometer_distance;
    totalDistance += distance;
    if (distance > longestDrive) longestDrive = distance;
    if (d.energy_consumed_net !== null) {
      energyConsumedKwh += d.energy_consumed_net;
      if (distance > 0) {
        effEnergyWh += d.energy_consumed_net * 1000;
        effDistance += distance;
      }
    }
  }

  let totalChargeCost = 0;
  let fastestChargeAvgKw: number | null = null;
  for (const c of charges) {
    totalChargeCost += c.cost;
    if (c.duration_min > 0) {
      const avgKw = c.charge_energy_added / (c.duration_min / 60);
      if (fastestChargeAvgKw === null || avgKw > fastestChargeAvgKw) fastestChargeAvgKw = avgKw;
    }
  }

  return {
    driveCount: drives.length,
    totalDistance,
    energyConsumedKwh,
    totalChargeCost,
    avgEfficiencyWhPerKm: effDistance > 0 ? effEnergyWh / effDistance : null,
    co2AvoidedKg: totalDistance * CO2_AVOIDED_KG_PER_KM,
    longestDrive,
    fastestChargeAvgKw,
  };
}

export interface SparklinePoint {
  date: string;
  value: number;
}

/** Buckets a metric by calendar day for a tiny trend sparkline. */
export function dailySparkline<T>(items: T[], getDate: (item: T) => string, getValue: (item: T) => number): SparklinePoint[] {
  const byDay = new Map<string, number>();
  for (const item of items) {
    const day = format(new Date(getDate(item)), "yyyy-MM-dd");
    byDay.set(day, (byDay.get(day) ?? 0) + getValue(item));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

export function dailyMaxSparkline<T>(items: T[], getDate: (item: T) => string, getValue: (item: T) => number): SparklinePoint[] {
  const byDay = new Map<string, number>();
  for (const item of items) {
    const day = format(new Date(getDate(item)), "yyyy-MM-dd");
    const value = getValue(item);
    byDay.set(day, Math.max(byDay.get(day) ?? -Infinity, value));
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

/** Per-day ratio of two summed quantities (e.g. Wh/km from energy and distance), skipping days with no denominator. */
export function dailyRatioSparkline<T>(
  items: T[],
  getDate: (item: T) => string,
  getNumerator: (item: T) => number,
  getDenominator: (item: T) => number
): SparklinePoint[] {
  const byDay = new Map<string, { num: number; den: number }>();
  for (const item of items) {
    const day = format(new Date(getDate(item)), "yyyy-MM-dd");
    const entry = byDay.get(day) ?? { num: 0, den: 0 };
    entry.num += getNumerator(item);
    entry.den += getDenominator(item);
    byDay.set(day, entry);
  }
  return Array.from(byDay.entries())
    .filter(([, { den }]) => den > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { num, den }]) => ({ date, value: num / den }));
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
