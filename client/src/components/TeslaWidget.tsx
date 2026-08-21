import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { socket } from "../lib/socket";
import { useStore } from "../store/useStore";
import type { TeslaSnapshot } from "../types";

const STATE_STYLE: Record<string, { label: string; color: string }> = {
  online: { label: "Online", color: "#34d399" },
  charging: { label: "Charging", color: "#22d3ee" },
  driving: { label: "Driving", color: "#7c5cff" },
  asleep: { label: "Asleep", color: "#94a3b8" },
  suspended: { label: "Suspended", color: "#94a3b8" },
  offline: { label: "Offline", color: "#f87171" },
  updating: { label: "Updating", color: "#f5c518" },
};

function batteryColor(level: number | null, charging: boolean): string {
  if (charging) return "#22d3ee";
  if (level === null) return "#94a3b8";
  if (level <= 15) return "#f87171";
  if (level <= 30) return "#f5c518";
  return "#34d399";
}

/** TeslaMate reports "time to full" in hours, as a decimal. */
function formatHours(hours: number | null): string | null {
  if (hours === null || hours <= 0) return null;
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "FL 42.8 · FR 43.1 · RL 42.8 · RR 41.7 psi" for the tyre warning tooltip. */
function tirePressureLabel(snapshot: TeslaSnapshot): string {
  const { fl, fr, rl, rr } = snapshot.tirePressures;
  const parts = [
    ["FL", fl],
    ["FR", fr],
    ["RL", rl],
    ["RR", rr],
  ]
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k} ${(v as number).toFixed(1)}`);
  return parts.length ? `${parts.join(" · ")} ${snapshot.pressureUnit}` : "";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="truncate text-sm font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function BatteryBar({ snapshot }: { snapshot: TeslaSnapshot }) {
  const level = snapshot.usableBatteryLevel ?? snapshot.batteryLevel;
  const color = batteryColor(level, snapshot.charging);
  const limit = snapshot.chargeLimit;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-2xl font-bold tabular-nums text-ink">
          {level === null ? "—" : `${level}%`}
        </span>
        {snapshot.charging && snapshot.chargerPower ? (
          <span className="text-xs font-semibold tabular-nums" style={{ color }}>
            +{snapshot.chargerPower} kW
          </span>
        ) : snapshot.pluggedIn ? (
          <span className="text-xs font-medium text-ink-muted">Plugged in</span>
        ) : null}
      </div>

      <div className="relative h-2.5 w-full overflow-hidden rounded-full sunken-strong">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={false}
          animate={{ width: `${Math.max(level ?? 0, 1.5)}%` }}
          transition={{ ease: "easeOut", duration: 0.5 }}
        />
        {/* Charge limit marker */}
        {limit !== null && limit > 0 && limit < 100 && (
          <span
            className="absolute top-0 h-full w-px bg-ink/50"
            style={{ left: `${limit}%` }}
            title={`Charge limit ${limit}%`}
          />
        )}
      </div>
    </div>
  );
}

export function TeslaWidget() {
  const authed = useStore((s) => s.authed);
  const editMode = useStore((s) => s.editMode);
  const [snapshot, setSnapshot] = useState<TeslaSnapshot | null>(null);

  useEffect(() => {
    let gotPush = false;

    function onUpdate(next: TeslaSnapshot) {
      gotPush = true;
      setSnapshot(next);
    }
    socket.on("teslamate:update", onUpdate);

    // The server emits once when the socket connects, which can land before this
    // listener is attached. Without a REST seed the widget would then stay blank
    // until the next poll — up to a minute while the car is asleep.
    api
      .get<TeslaSnapshot>("/teslamate/status")
      .then((initial) => {
        if (!gotPush) setSnapshot(initial);
      })
      .catch(() => {
        /* socket updates will fill this in if the car is reachable */
      });

    return () => {
      socket.off("teslamate:update", onUpdate);
    };
  }, []);

  if (!snapshot) return null;

  if (!snapshot.configured) {
    if (!editMode) return null;
    return (
      <section className="glass rounded-2xl p-5">
        <h2 className="text-base font-semibold text-ink">Car</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Connect TeslaMate under Settings → Car to show your vehicle here.
        </p>
      </section>
    );
  }

  const stateStyle = STATE_STYLE[snapshot.state] ?? { label: snapshot.state, color: "#94a3b8" };
  const range = snapshot.ratedRange ?? snapshot.estRange;
  const timeToFull = formatHours(snapshot.timeToFullCharge);
  const asleep = snapshot.state === "asleep" || snapshot.state === "offline";

  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
          ⚡
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight text-ink">
            {snapshot.name || "Car"}
          </h2>
          <p className="truncate text-xs text-ink-muted">
            {snapshot.geofence ?? (snapshot.reachable ? "Location unknown" : "Cannot reach TeslaMate")}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: `${stateStyle.color}26`, color: stateStyle.color }}
        >
          {stateStyle.label}
        </span>
      </div>

      {!snapshot.reachable ? (
        <p className="rounded-xl bg-red-500/10 px-3.5 py-3 text-xs text-red-300">
          {snapshot.error ?? "TeslaMate is unreachable"} — check the URL and token in Settings.
        </p>
      ) : (
        <>
          <BatteryBar snapshot={snapshot} />

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl sunken px-3.5 py-2.5">
            <Stat
              label="Range"
              value={range === null ? "—" : `${Math.round(range)} ${snapshot.lengthUnit}`}
            />
            <Stat
              label={snapshot.charging ? "Full in" : "Odometer"}
              value={
                snapshot.charging
                  ? (timeToFull ?? "—")
                  : snapshot.odometer === null
                    ? "—"
                    : `${Math.round(snapshot.odometer).toLocaleString()} ${snapshot.lengthUnit}`
              }
            />
            <Stat
              label="Inside"
              value={
                snapshot.insideTemp === null
                  ? "—"
                  : `${Math.round(snapshot.insideTemp)}°${snapshot.tempUnit}`
              }
            />
          </div>

          {snapshot.state === "driving" && snapshot.speed !== null && (
            <p className="mt-3 text-center text-sm font-semibold tabular-nums text-accent">
              {Math.round(snapshot.speed)} {snapshot.lengthUnit}/h
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-muted">
            <span title={snapshot.locked ? "Locked" : "Unlocked"}>
              {snapshot.locked ? "🔒 Locked" : "🔓 Unlocked"}
            </span>
            {snapshot.sentryMode && <span>👁 Sentry</span>}
            {snapshot.climateOn && <span>❄ Climate on</span>}
            {snapshot.windowsOpen && <span className="text-amber-400">Windows open</span>}
            {snapshot.doorsOpen && <span className="text-amber-400">Doors open</span>}
            {snapshot.updateAvailable && <span className="text-accent">Update available</span>}
            {snapshot.tireWarning && (
              <span className="text-amber-400" title={tirePressureLabel(snapshot)}>
                Tire pressure low
              </span>
            )}
            {asleep && snapshot.outsideTemp !== null && (
              <span>
                Outside {Math.round(snapshot.outsideTemp)}°{snapshot.tempUnit}
              </span>
            )}
          </div>

          {(snapshot.charging || snapshot.pluggedIn) && snapshot.chargeEnergyAdded ? (
            <p className="mt-2 text-[11px] text-ink-muted">
              {snapshot.chargeEnergyAdded} kWh added this session
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
