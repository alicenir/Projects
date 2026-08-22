import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { formatISO, startOfDay, startOfYear, subDays } from "date-fns";

const PRESET_DAYS: Partial<Record<DateRangePreset, number>> = { "7d": 7, "30d": 30, "90d": 90 };

export type DateRangePreset = "7d" | "30d" | "90d" | "ytd" | "all";

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
  ytd: "YTD",
  all: "All",
};

interface DateRangeContextValue {
  preset: DateRangePreset;
  setPreset: (preset: DateRangePreset) => void;
  /** RFC3339 start, or undefined for "all". Passed straight through to the API's startDate/endDate query params. */
  startDate?: string;
  endDate?: string;
  /** The immediately preceding period of equal length, for period-over-period deltas. Undefined for "ytd"/"all", which don't have a natural equal-length prior period. */
  previousRange?: { startDate: string; endDate: string };
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

function rangeFor(preset: DateRangePreset): { startDate?: string; endDate?: string } {
  const now = new Date();
  switch (preset) {
    case "7d":
      return { startDate: formatISO(startOfDay(subDays(now, 7))) };
    case "30d":
      return { startDate: formatISO(startOfDay(subDays(now, 30))) };
    case "90d":
      return { startDate: formatISO(startOfDay(subDays(now, 90))) };
    case "ytd":
      return { startDate: formatISO(startOfYear(now)) };
    case "all":
      return {};
  }
}

function previousRangeFor(preset: DateRangePreset): { startDate: string; endDate: string } | undefined {
  const days = PRESET_DAYS[preset];
  if (!days) return undefined;
  const now = new Date();
  return {
    startDate: formatISO(startOfDay(subDays(now, days * 2))),
    endDate: formatISO(startOfDay(subDays(now, days))),
  };
}

export function DateRangeProvider({ children }: { children: ReactNode }) {
  const [preset, setPreset] = useState<DateRangePreset>("30d");
  const value = useMemo(
    () => ({ preset, setPreset, ...rangeFor(preset), previousRange: previousRangeFor(preset) }),
    [preset]
  );
  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider");
  return ctx;
}
