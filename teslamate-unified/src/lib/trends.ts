import { format } from "date-fns";
import type { Charge, Drive } from "@/api/schemas";

export interface DayValue {
  date: string; // yyyy-MM-dd
  distance: number;
}

export function dailyDistance(drives: Drive[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const d of drives) {
    const day = format(new Date(d.start_date), "yyyy-MM-dd");
    byDay.set(day, (byDay.get(day) ?? 0) + d.odometer_details.odometer_distance);
  }
  return byDay;
}

export interface HourCount {
  hour: number;
  label: string;
  count: number;
}

export function drivesByHourOfDay(drives: Drive[]): HourCount[] {
  const counts = new Array(24).fill(0);
  for (const d of drives) counts[new Date(d.start_date).getHours()] += 1;
  return counts.map((count, hour) => ({ hour, label: `${hour}h`, count }));
}

export interface MonthlyStat {
  month: string; // yyyy-MM
  distance: number;
  energyKwh: number;
  cost: number;
  avgConsumption: number | null;
  avgOutsideTemp: number | null;
}

export function monthlyStats(drives: Drive[], charges: Charge[]): MonthlyStat[] {
  const byMonth = new Map<
    string,
    { distance: number; energyKwh: number; cost: number; consumptionSum: number; consumptionN: number; tempSum: number; tempN: number }
  >();

  function bucket(month: string) {
    let b = byMonth.get(month);
    if (!b) {
      b = { distance: 0, energyKwh: 0, cost: 0, consumptionSum: 0, consumptionN: 0, tempSum: 0, tempN: 0 };
      byMonth.set(month, b);
    }
    return b;
  }

  for (const d of drives) {
    const month = format(new Date(d.start_date), "yyyy-MM");
    const b = bucket(month);
    b.distance += d.odometer_details.odometer_distance;
    if (d.energy_consumed_net !== null) b.energyKwh += d.energy_consumed_net;
    if (d.consumption_net !== null) {
      b.consumptionSum += d.consumption_net;
      b.consumptionN += 1;
    }
    if (d.outside_temp_avg !== null) {
      b.tempSum += d.outside_temp_avg;
      b.tempN += 1;
    }
  }
  for (const c of charges) {
    const month = format(new Date(c.start_date), "yyyy-MM");
    bucket(month).cost += c.cost;
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, b]) => ({
      month,
      distance: b.distance,
      energyKwh: b.energyKwh,
      cost: b.cost,
      avgConsumption: b.consumptionN > 0 ? b.consumptionSum / b.consumptionN : null,
      avgOutsideTemp: b.tempN > 0 ? b.tempSum / b.tempN : null,
    }));
}
