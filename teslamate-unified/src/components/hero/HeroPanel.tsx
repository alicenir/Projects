import type { ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import { DoorOpen, Fan, Lock, ShieldAlert, Thermometer, Unlock } from "lucide-react";
import { useCarStatus } from "@/api/hooks";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUnits } from "@/context/UnitsContext";
import { formatDistance, formatTemp, type LengthUnit, type TempUnit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { BatteryRing } from "./BatteryRing";
import { MiniMap } from "./MiniMap";
import { StatePill } from "./StatePill";

export function HeroPanel({ carId }: { carId: number }) {
  const { data, isLoading, isError, error, refetch } = useCarStatus(carId);
  const { system } = useUnits();

  if (isLoading) {
    return (
      <Card className="grid gap-6 p-6 lg:grid-cols-[auto_1fr_260px]">
        <Skeleton className="h-[168px] w-[168px] rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-4 w-full max-w-sm" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="p-6">
        <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => refetch()} />
      </Card>
    );
  }

  if (!data) return null;

  const status = data.data.status;
  const units = data.data.units;
  const lengthUnit = units.unit_of_length as LengthUnit;
  const tempUnit = units.unit_of_temperature as TempUnit;

  const battery = status.battery_details;
  const charging = status.charging_details;
  const climate = status.climate_details;
  const doors = status.car_status;
  const geo = status.car_geodata;

  const anyDoorOpen =
    doors.doors_open ||
    doors.driver_front_door_open ||
    doors.driver_rear_door_open ||
    doors.passenger_front_door_open ||
    doors.passenger_rear_door_open ||
    doors.trunk_open ||
    doors.frunk_open;

  const stateSince = status.state_since ? new Date(status.state_since) : null;

  return (
    <Card className="overflow-hidden bg-gradient-to-br from-surface to-surface-raised p-6">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr_280px]">
        <div className="flex flex-col items-center gap-3">
          <BatteryRing level={battery.battery_level} limit={charging.charge_limit_soc} charging={charging.charging_state === "Charging"} />
          <div className="text-center text-xs text-ink-muted">
            <div>
              est {formatDistance(battery.est_battery_range, lengthUnit, system)} · rated{" "}
              {formatDistance(battery.rated_battery_range, lengthUnit, system)}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-ink">{status.display_name || "Tesla"}</h2>
            <StatePill state={status.state} />
            {!status.car_status.healthy && (
              <Badge tone="alert">
                <ShieldAlert className="h-3 w-3" /> Logger unhealthy
              </Badge>
            )}
            {status.car_versions.update_available && (
              <Badge tone="drive">Update available · {status.car_versions.update_version}</Badge>
            )}
          </div>

          {stateSince && (
            <p className="text-xs text-ink-muted">
              {status.state === "asleep" || status.state === "offline" ? "Last seen" : "Since"}{" "}
              {formatDistanceToNow(stateSince, { addSuffix: true })}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Odometer" value={formatDistance(status.odometer, lengthUnit, system)} />
            <StatTile
              label="Inside / Outside"
              value={`${formatTemp(climate.inside_temp, tempUnit, system)} / ${formatTemp(climate.outside_temp, tempUnit, system)}`}
              icon={<Thermometer className="h-3.5 w-3.5" />}
            />
            <StatTile label="Climate" value={climate.is_climate_on ? "On" : "Off"} icon={<Fan className="h-3.5 w-3.5" />} />
            <StatTile label="Firmware" value={status.car_versions.version || "—"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={doors.locked ? "neutral" : "alert"}>
              {doors.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              {doors.locked ? "Locked" : "Unlocked"}
            </Badge>
            <Badge tone={anyDoorOpen ? "alert" : "neutral"}>
              <DoorOpen className="h-3 w-3" />
              {anyDoorOpen ? "Open" : "Closed"}
            </Badge>
            <Badge tone={doors.sentry_mode ? "drive" : "neutral"} pulse={doors.sentry_mode}>
              <ShieldAlert className="h-3 w-3" />
              Sentry {doors.sentry_mode ? "on" : "off"}
            </Badge>
            {geo.geofence && <Badge tone="neutral">{geo.geofence}</Badge>}
          </div>
        </div>

        <div className={cn("min-h-[140px]", "lg:h-full")}>
          <MiniMap latitude={geo.location.latitude || geo.latitude || null} longitude={geo.location.longitude || geo.longitude || null} />
        </div>
      </div>
    </Card>
  );
}

function StatTile({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-raised/60 p-3">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}
