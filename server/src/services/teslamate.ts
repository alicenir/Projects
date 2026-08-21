import type { Server } from "socket.io";
import { getSetting } from "../db.js";

export interface TeslaSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;

  name: string;
  state: string;
  stateSince: string | null;
  healthy: boolean;

  batteryLevel: number | null;
  usableBatteryLevel: number | null;
  chargeLimit: number | null;
  estRange: number | null;
  ratedRange: number | null;

  pluggedIn: boolean;
  charging: boolean;
  chargingState: string | null;
  chargerPower: number | null;
  chargeEnergyAdded: number | null;
  timeToFullCharge: number | null;
  scheduledChargingStart: string | null;

  tirePressures: { fl: number | null; fr: number | null; rl: number | null; rr: number | null };
  tireWarning: boolean;
  pressureUnit: string;

  odometer: number | null;
  speed: number | null;
  shiftState: string | null;

  insideTemp: number | null;
  outsideTemp: number | null;
  climateOn: boolean;

  geofence: string | null;
  latitude: number | null;
  longitude: number | null;

  locked: boolean;
  sentryMode: boolean;
  windowsOpen: boolean;
  doorsOpen: boolean;
  updateAvailable: boolean;
  version: string | null;

  /** "km" | "mi" and "C" | "F", as reported by TeslaMate itself. */
  lengthUnit: string;
  tempUnit: string;
}

function emptySnapshot(configured: boolean, error?: string): TeslaSnapshot {
  return {
    configured,
    reachable: false,
    error,
    name: "",
    state: "unknown",
    stateSince: null,
    healthy: false,
    batteryLevel: null,
    usableBatteryLevel: null,
    chargeLimit: null,
    estRange: null,
    ratedRange: null,
    pluggedIn: false,
    charging: false,
    chargingState: null,
    chargerPower: null,
    chargeEnergyAdded: null,
    timeToFullCharge: null,
    scheduledChargingStart: null,
    tirePressures: { fl: null, fr: null, rl: null, rr: null },
    tireWarning: false,
    pressureUnit: "psi",
    odometer: null,
    speed: null,
    shiftState: null,
    insideTemp: null,
    outsideTemp: null,
    climateOn: false,
    geofence: null,
    latitude: null,
    longitude: null,
    locked: false,
    sentryMode: false,
    windowsOpen: false,
    doorsOpen: false,
    updateAvailable: false,
    version: null,
    lengthUnit: "km",
    tempUnit: "C",
  };
}

function config(): { url: string; token: string; carId: string } | null {
  const url = getSetting("teslamate_url");
  if (!url) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token: getSetting("teslamate_api_token") ?? "",
    carId: getSetting("teslamate_car_id") || "1",
  };
}

async function call(path: string, overrides?: { url: string; token: string }) {
  const cfg = overrides ?? config();
  if (!cfg) throw new Error("not_configured");

  const headers: Record<string, string> = { Accept: "application/json" };
  // TeslaMateApi only requires this when API_TOKEN_DISABLE=false.
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${cfg.url}${path}`, { headers, signal: controller.signal });
    if (res.status === 401 || res.status === 403) throw new Error("Unauthorized — check the API token");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function num(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/** Same as num(), but treats 0 as "no reading" for fields where 0 is a placeholder. */
function positive(value: unknown): number | null {
  const n = num(value);
  return n !== null && n > 0 ? n : null;
}

/**
 * TeslaMateApi returns a zero-value timestamp ("0001-01-01T02:20:54+02:20")
 * rather than null when no charge is scheduled.
 */
function realDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).getUTCFullYear() < 2000 ? null : value;
}

export async function getSnapshot(): Promise<TeslaSnapshot> {
  const cfg = config();
  if (!cfg) return emptySnapshot(false);

  try {
    const body = await call(`/api/v1/cars/${cfg.carId}/status`);
    // TeslaMateApi wraps everything in { data: { car, status } }.
    const status = body?.data?.status ?? body?.data ?? body ?? {};
    const car = body?.data?.car ?? {};

    const battery = status.battery_details ?? {};
    const charging = status.charging_details ?? {};
    const climate = status.climate_details ?? {};
    const driving = status.driving_details ?? {};
    const geo = status.car_geodata ?? {};
    const carStatus = status.car_status ?? {};
    const versions = status.car_versions ?? {};
    const units = status.units ?? {};

    const tpms = status.tpms_details ?? {};
    const state = String(status.state ?? "unknown").toLowerCase();
    const chargerPower = num(charging.charger_power);
    const chargingState = charging.charging_state
      ? String(charging.charging_state).toLowerCase()
      : null;
    const pluggedIn = Boolean(charging.plugged_in) || chargingState === "charging";

    return {
      configured: true,
      reachable: true,
      name: status.display_name ?? car.car_name ?? "Tesla",
      state,
      stateSince: status.state_since ?? null,
      healthy: carStatus.healthy !== false,

      batteryLevel: num(battery.battery_level),
      usableBatteryLevel: num(battery.usable_battery_level),
      chargeLimit: num(charging.charge_limit_soc),
      // A range of 0 means "not reported", not "no range left".
      estRange: positive(battery.est_battery_range),
      ratedRange: positive(battery.rated_battery_range),

      pluggedIn,
      charging:
        chargingState === "charging" ||
        state === "charging" ||
        (chargerPower !== null && chargerPower > 0),
      chargingState,
      chargerPower,
      chargeEnergyAdded: num(charging.charge_energy_added),
      timeToFullCharge: num(charging.time_to_full_charge),
      scheduledChargingStart: realDate(charging.scheduled_charging_start_time),

      tirePressures: {
        fl: positive(tpms.tpms_pressure_fl),
        fr: positive(tpms.tpms_pressure_fr),
        rl: positive(tpms.tpms_pressure_rl),
        rr: positive(tpms.tpms_pressure_rr),
      },
      tireWarning: Boolean(
        tpms.tpms_soft_warning_fl ||
          tpms.tpms_soft_warning_fr ||
          tpms.tpms_soft_warning_rl ||
          tpms.tpms_soft_warning_rr
      ),
      pressureUnit: units.unit_of_pressure ?? "psi",

      odometer: num(status.odometer),
      speed: num(driving.speed),
      shiftState: driving.shift_state ?? null,

      insideTemp: num(climate.inside_temp),
      outsideTemp: num(climate.outside_temp),
      climateOn: Boolean(climate.is_climate_on),

      geofence: geo.geofence ?? null,
      latitude: num(geo.latitude),
      longitude: num(geo.longitude),

      locked: Boolean(carStatus.locked),
      sentryMode: Boolean(carStatus.sentry_mode),
      windowsOpen: Boolean(carStatus.windows_open),
      doorsOpen: Boolean(carStatus.doors_open),
      updateAvailable: Boolean(versions.update_available),
      version: versions.version ?? null,

      lengthUnit: units.unit_of_length ?? "km",
      tempUnit: units.unit_of_temperature ?? "C",
    };
  } catch (err) {
    return emptySnapshot(true, err instanceof Error ? err.message : "unreachable");
  }
}

export async function testConnection(url: string, token: string) {
  try {
    const base = { url: url.replace(/\/+$/, ""), token };
    const body = await call("/api/v1/cars", base);
    const cars = body?.data?.cars ?? [];
    if (!Array.isArray(cars) || cars.length === 0) {
      return { ok: true, cars: [], warning: "Connected, but no cars were returned" };
    }
    return {
      ok: true,
      cars: cars.map((c: any) => ({
        id: c.car_id ?? c.id,
        name: c.car_name ?? c.name ?? `Car ${c.car_id ?? c.id}`,
      })),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unreachable" };
  }
}

let pollHandle: ReturnType<typeof setTimeout> | null = null;

export function startTeslaPolling(io: Server) {
  const tick = async () => {
    let interval = 60_000;
    try {
      const snapshot = await getSnapshot();
      io.emit("teslamate:update", snapshot);
      if (!snapshot.configured) interval = 60_000;
      else if (!snapshot.reachable) interval = 30_000;
      // Don't poll a sleeping car often — TeslaMate can't wake it, but there's
      // nothing to see either.
      else if (snapshot.state === "asleep" || snapshot.state === "offline") interval = 60_000;
      else if (snapshot.state === "driving" || snapshot.state === "charging") interval = 10_000;
      else interval = 30_000;
    } catch {
      interval = 60_000;
    }
    pollHandle = setTimeout(tick, interval);
  };
  tick();
}

export function stopTeslaPolling() {
  if (pollHandle) clearTimeout(pollHandle);
}
