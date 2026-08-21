import { getSetting } from "../db.js";

/**
 * Open-Meteo needs no API key and no signup, which keeps this consistent with
 * every other integration here. It is the only service that talks to the
 * public internet rather than something on your LAN.
 */
const FORECAST_URL = process.env.OPEN_METEO_URL ?? "https://api.open-meteo.com/v1/forecast";
const GEOCODE_URL =
  process.env.OPEN_METEO_GEOCODE_URL ?? "https://geocoding-api.open-meteo.com/v1/search";

export interface WeatherDay {
  date: string;
  code: number;
  description: string;
  max: number | null;
  min: number | null;
  precipitationChance: number | null;
}

export interface WeatherSnapshot {
  configured: boolean;
  reachable: boolean;
  error?: string;
  label: string;
  temperature: number | null;
  feelsLike: number | null;
  humidity: number | null;
  windSpeed: number | null;
  code: number;
  description: string;
  isDay: boolean;
  sunrise: string | null;
  sunset: string | null;
  days: WeatherDay[];
  tempUnit: string;
  windUnit: string;
}

/** WMO weather interpretation codes used by Open-Meteo. */
const WMO: Record<number, string> = {
  0: "Clear",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Violent showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

export function describeCode(code: number): string {
  return WMO[code] ?? "Unknown";
}

function empty(configured: boolean, error?: string): WeatherSnapshot {
  return {
    configured,
    reachable: false,
    error,
    label: "",
    temperature: null,
    feelsLike: null,
    humidity: null,
    windSpeed: null,
    code: 0,
    description: "",
    isDay: true,
    sunrise: null,
    sunset: null,
    days: [],
    tempUnit: "°C",
    windUnit: "km/h",
  };
}

function config() {
  const lat = getSetting("weather_latitude");
  const lon = getSetting("weather_longitude");
  if (!lat || !lon) return null;
  return {
    lat,
    lon,
    label: getSetting("weather_label") || "",
    imperial: getSetting("weather_units") === "imperial",
  };
}

let cache: { at: number; snapshot: WeatherSnapshot } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export async function getWeather(force = false): Promise<WeatherSnapshot> {
  const cfg = config();
  if (!cfg) return empty(false);
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.snapshot;

  const params = new URLSearchParams({
    latitude: cfg.lat,
    longitude: cfg.lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "4",
    temperature_unit: cfg.imperial ? "fahrenheit" : "celsius",
    wind_speed_unit: cfg.imperial ? "mph" : "kmh",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${FORECAST_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const current = data.current ?? {};
    const daily = data.daily ?? {};
    const times: string[] = daily.time ?? [];

    const snapshot: WeatherSnapshot = {
      configured: true,
      reachable: true,
      label: cfg.label,
      temperature: current.temperature_2m ?? null,
      feelsLike: current.apparent_temperature ?? null,
      humidity: current.relative_humidity_2m ?? null,
      windSpeed: current.wind_speed_10m ?? null,
      code: current.weather_code ?? 0,
      description: describeCode(current.weather_code ?? 0),
      isDay: current.is_day !== 0,
      sunrise: daily.sunrise?.[0] ?? null,
      sunset: daily.sunset?.[0] ?? null,
      // Skip today; the current conditions above already cover it.
      days: times.slice(1).map((date, i) => {
        const index = i + 1;
        const code = daily.weather_code?.[index] ?? 0;
        return {
          date,
          code,
          description: describeCode(code),
          max: daily.temperature_2m_max?.[index] ?? null,
          min: daily.temperature_2m_min?.[index] ?? null,
          precipitationChance: daily.precipitation_probability_max?.[index] ?? null,
        };
      }),
      tempUnit: cfg.imperial ? "°F" : "°C",
      windUnit: cfg.imperial ? "mph" : "km/h",
    };

    cache = { at: Date.now(), snapshot };
    return snapshot;
  } catch (err) {
    return empty(true, err instanceof Error ? err.message : "unreachable");
  } finally {
    clearTimeout(timeout);
  }
}

export function invalidateWeatherCache() {
  cache = null;
}

export interface GeocodeResult {
  name: string;
  country: string;
  admin1: string | null;
  latitude: number;
  longitude: number;
}

/** Powers the "search for your city" box in settings, so no one types coordinates. */
export async function geocode(name: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ name, count: "8", format: "json" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${GEOCODE_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.results ?? []).map((r: any) => ({
      name: r.name,
      country: r.country ?? "",
      admin1: r.admin1 ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
    }));
  } finally {
    clearTimeout(timeout);
  }
}
