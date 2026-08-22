import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { UnitSystem } from "@/lib/units";

const STORAGE_KEY = "teslamate-unified:units";

interface UnitsContextValue {
  system: UnitSystem;
  setSystem: (system: UnitSystem) => void;
  /** Called once with TeslaMate's own configured unit so the toggle starts in sync, before the user overrides it. */
  syncDefault: (system: UnitSystem) => void;
}

const UnitsContext = createContext<UnitsContextValue | null>(null);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [system, setSystemState] = useState<UnitSystem>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "metric" || stored === "imperial" ? stored : "metric";
    } catch {
      return "metric";
    }
  });
  const [userOverrode, setUserOverrode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  function setSystem(next: UnitSystem) {
    setSystemState(next);
    setUserOverrode(true);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort only
    }
  }

  function syncDefault(next: UnitSystem) {
    if (!userOverrode) setSystemState(next);
  }

  const value = useMemo(() => ({ system, setSystem, syncDefault }), [system, userOverrode]);

  return <UnitsContext.Provider value={value}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within UnitsProvider");
  return ctx;
}
