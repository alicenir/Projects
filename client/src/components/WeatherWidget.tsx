import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { WeatherSnapshot } from "../types";

/** WMO code -> glyph. Day/night only differs for the clear/partly-cloudy codes. */
export function weatherIcon(code: number, isDay = true): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code === 1 || code === 2) return isDay ? "🌤️" : "☁️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌦️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code === 85 || code === 86) return "🌨️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function shortTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function dayName(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { weekday: "short" });
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<WeatherSnapshot>("/weather");
        if (!cancelled) setWeather(data);
      } catch {
        /* leave the widget hidden */
      }
    }
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!weather || !weather.configured) return null;

  if (!weather.reachable) {
    return (
      <section className="glass rounded-2xl p-5">
        <h2 className="text-base font-semibold text-ink">Weather</h2>
        <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {weather.error ?? "Could not reach the weather service"}
        </p>
      </section>
    );
  }

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <span className="text-4xl leading-none" aria-hidden>
          {weatherIcon(weather.code, weather.isDay)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {weather.label || "Weather"}
          </p>
          <p className="text-2xl font-bold tabular-nums leading-tight text-ink">
            {weather.temperature === null ? "—" : Math.round(weather.temperature)}
            {weather.tempUnit}
          </p>
          <p className="truncate text-xs text-ink-muted">
            {weather.description}
            {weather.feelsLike !== null && ` · feels ${Math.round(weather.feelsLike)}${weather.tempUnit}`}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {weather.days.slice(0, 3).map((d) => (
          <div key={d.date} className="rounded-xl sunken px-2 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
              {dayName(d.date)}
            </p>
            <p className="my-0.5 text-lg leading-none" aria-hidden>
              {weatherIcon(d.code)}
            </p>
            <p className="text-[11px] font-semibold tabular-nums text-ink">
              {d.max === null ? "—" : Math.round(d.max)}°
              <span className="ml-1 font-normal text-ink-muted">
                {d.min === null ? "" : Math.round(d.min)}°
              </span>
            </p>
            {d.precipitationChance !== null && d.precipitationChance > 20 && (
              <p className="text-[10px] tabular-nums text-accent">{d.precipitationChance}%</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted">
        <span>↑ {shortTime(weather.sunrise)}</span>
        <span>↓ {shortTime(weather.sunset)}</span>
        {weather.windSpeed !== null && (
          <span className="tabular-nums">
            {Math.round(weather.windSpeed)} {weather.windUnit}
          </span>
        )}
        {weather.humidity !== null && <span className="tabular-nums">{weather.humidity}%</span>}
      </div>
    </section>
  );
}
