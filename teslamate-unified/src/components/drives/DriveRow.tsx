import { format } from "date-fns";
import { ArrowRight, BatteryMedium, Gauge, Zap } from "lucide-react";
import type { Drive } from "@/api/schemas";
import { useUnits } from "@/context/UnitsContext";
import { displayDistance, formatSpeed, type LengthUnit } from "@/lib/units";

export function DriveRow({ drive, lengthUnit, onClick }: { drive: Drive; lengthUnit: LengthUnit; onClick: () => void }) {
  const { system } = useUnits();
  const distance = displayDistance(drive.odometer_details.odometer_distance, lengthUnit, system);
  const distUnit = system === "imperial" ? "mi" : "km";

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="truncate font-medium text-ink">{drive.start_address || "Unknown"}</span>
        <ArrowRight className="h-3.5 w-3.5 flex-none text-ink-muted" />
        <span className="truncate font-medium text-ink">{drive.end_address || "Unknown"}</span>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-3 text-xs text-ink-muted">
        <span>{format(new Date(drive.start_date), "MMM d, HH:mm")}</span>
        <span className="tabular-nums">{drive.duration_str}</span>
        <span className="flex items-center gap-1 tabular-nums">
          <Gauge className="h-3 w-3" /> {distance.toFixed(1)} {distUnit}
        </span>
        <span className="tabular-nums">avg {formatSpeed(drive.speed_avg, lengthUnit, system)}</span>
        {drive.consumption_net !== null && (
          <span className="flex items-center gap-1 tabular-nums">
            <Zap className="h-3 w-3" /> {Math.round(drive.consumption_net)} Wh/{distUnit === "mi" ? "mi" : "km"}
          </span>
        )}
        <span className="flex items-center gap-1 tabular-nums">
          <BatteryMedium className="h-3 w-3" />
          {drive.battery_details.start_battery_level}% → {drive.battery_details.end_battery_level}%
        </span>
      </div>
    </button>
  );
}
