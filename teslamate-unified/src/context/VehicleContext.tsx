import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCars } from "@/api/hooks";
import type { Car } from "@/api/schemas";

const STORAGE_KEY = "teslamate-unified:car-id";

interface VehicleContextValue {
  carId: number | null;
  car: Car | null;
  cars: Car[];
  setCarId: (id: number) => void;
  isLoading: boolean;
  isError: boolean;
}

const VehicleContext = createContext<VehicleContextValue | null>(null);

export function VehicleProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useCars();
  const cars = data?.data.cars ?? [];

  const [carId, setCarIdState] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? Number(stored) : null;
    } catch {
      return null;
    }
  });

  // Once cars load, fall back to the first one if nothing was stored (or the
  // stored id no longer exists).
  useEffect(() => {
    if (cars.length === 0) return;
    if (carId !== null && cars.some((c) => c.car_id === carId)) return;
    setCarIdState(cars[0].car_id);
  }, [cars, carId]);

  function setCarId(id: number) {
    setCarIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // best-effort only
    }
  }

  const car = cars.find((c) => c.car_id === carId) ?? null;

  const value = useMemo(
    () => ({ carId, car, cars, setCarId, isLoading, isError }),
    [carId, car, cars, isLoading, isError]
  );

  return <VehicleContext.Provider value={value}>{children}</VehicleContext.Provider>;
}

export function useVehicle() {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error("useVehicle must be used within VehicleProvider");
  return ctx;
}
