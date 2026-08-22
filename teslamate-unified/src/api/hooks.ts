import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, type DateRangeParams } from "./client";

const PAGE_SIZE = 30;

export function usePing() {
  return useQuery({
    queryKey: ["ping"],
    queryFn: api.ping,
    refetchInterval: 15_000,
    retry: 1,
  });
}

export function useCars() {
  return useQuery({
    queryKey: ["cars"],
    queryFn: api.cars,
    staleTime: 60_000,
  });
}

export function useCar(carId: number | null) {
  return useQuery({
    queryKey: ["car", carId],
    queryFn: () => api.car(carId as number),
    enabled: carId !== null,
    staleTime: 60_000,
  });
}

/**
 * /status is MQTT-backed on the API side — there's no push channel we can
 * subscribe to from the browser without a broker exposed over websockets,
 * so this polls, backing off by vehicle state the same way TeslaMate's own
 * dashboards do: fast while something's actually happening, slow otherwise.
 */
export function useCarStatus(carId: number | null) {
  return useQuery({
    queryKey: ["status", carId],
    queryFn: () => api.status(carId as number),
    enabled: carId !== null,
    refetchInterval: (query) => {
      const state = query.state.data?.data.status.state;
      if (!state) return 30_000;
      if (state === "driving" || state === "charging") return 10_000;
      if (state === "asleep" || state === "offline") return 60_000;
      return 30_000;
    },
    retry: 1,
  });
}

export function useDrives(carId: number | null, range: DateRangeParams, filters: { minDistance?: number; maxDistance?: number; location?: string } = {}) {
  return useInfiniteQuery({
    queryKey: ["drives", carId, range, filters],
    queryFn: ({ pageParam }) =>
      api.drives(carId as number, { ...range, ...filters, page: pageParam, show: PAGE_SIZE }),
    enabled: carId !== null,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.data.drives.length === PAGE_SIZE ? pages.length + 1 : undefined,
    staleTime: 60_000,
  });
}

export function useDriveDetail(carId: number | null, driveId: number | null) {
  return useQuery({
    queryKey: ["drive", carId, driveId],
    queryFn: () => api.driveDetail(carId as number, driveId as number),
    enabled: carId !== null && driveId !== null,
  });
}

export function useCharges(carId: number | null, range: DateRangeParams, filters: { location?: string } = {}) {
  return useInfiniteQuery({
    queryKey: ["charges", carId, range, filters],
    queryFn: ({ pageParam }) =>
      api.charges(carId as number, { ...range, ...filters, page: pageParam, show: PAGE_SIZE }),
    enabled: carId !== null,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.data.charges.length === PAGE_SIZE ? pages.length + 1 : undefined,
    staleTime: 60_000,
  });
}

export function useChargeDetail(carId: number | null, chargeId: number | null) {
  return useQuery({
    queryKey: ["charge", carId, chargeId],
    queryFn: () => api.chargeDetail(carId as number, chargeId as number),
    enabled: carId !== null && chargeId !== null,
  });
}

export function useBatteryHealth(carId: number | null) {
  return useQuery({
    queryKey: ["battery-health", carId],
    queryFn: () => api.batteryHealth(carId as number),
    enabled: carId !== null,
    staleTime: 5 * 60_000,
  });
}

export function useUpdates(carId: number | null) {
  return useQuery({
    queryKey: ["updates", carId],
    queryFn: () => api.updates(carId as number, { show: 100 }),
    enabled: carId !== null,
    staleTime: 5 * 60_000,
  });
}

export function useGlobalSettings() {
  return useQuery({
    queryKey: ["globalsettings"],
    queryFn: api.globalSettings,
    staleTime: 5 * 60_000,
  });
}
