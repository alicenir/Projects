import { format } from "date-fns";
import type { Charge } from "@/api/schemas";

export type LocationClass = "home" | "work" | "supercharger" | "public";

export const LOCATION_CLASS_LABEL: Record<LocationClass, string> = {
  home: "Home",
  work: "Work",
  supercharger: "Supercharger",
  public: "Public",
};

export const LOCATION_CLASS_COLOR: Record<LocationClass, string> = {
  home: "--charge",
  work: "--drive",
  supercharger: "--battery",
  public: "--efficiency",
};

/** Best-effort classification from the address string TeslaMateAPI already resolves (geofence name, or a formatted street address). */
export function classifyLocation(address: string): LocationClass {
  const a = address.toLowerCase();
  if (a.includes("supercharger")) return "supercharger";
  if (a === "home" || a.startsWith("home,") || a.startsWith("home ")) return "home";
  if (a === "work" || a.startsWith("work,") || a.startsWith("work ")) return "work";
  return "public";
}

export interface LocationSummary {
  address: string;
  locationClass: LocationClass;
  sessions: number;
  energyKwh: number;
  cost: number;
}

export function summarizeLocations(charges: Charge[]): LocationSummary[] {
  const byAddress = new Map<string, LocationSummary>();
  for (const c of charges) {
    const key = c.address || "Unknown";
    const entry = byAddress.get(key) ?? {
      address: key,
      locationClass: classifyLocation(key),
      sessions: 0,
      energyKwh: 0,
      cost: 0,
    };
    entry.sessions += 1;
    entry.energyKwh += c.charge_energy_added;
    entry.cost += c.cost;
    byAddress.set(key, entry);
  }
  return Array.from(byAddress.values()).sort((a, b) => b.energyKwh - a.energyKwh);
}

export interface MonthlyCost {
  month: string;
  home: number;
  public: number;
}

/** Home vs. everything-else (work, Supercharger, other public) — a simple two-way split, per spec. */
export function monthlyCostBreakdown(charges: Charge[]): MonthlyCost[] {
  const byMonth = new Map<string, MonthlyCost>();
  for (const c of charges) {
    const month = format(new Date(c.start_date), "yyyy-MM");
    const entry = byMonth.get(month) ?? { month, home: 0, public: 0 };
    if (classifyLocation(c.address) === "home") entry.home += c.cost;
    else entry.public += c.cost;
    byMonth.set(month, entry);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
}
