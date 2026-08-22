import { format } from "date-fns";
import { Clock, DollarSign, Zap } from "lucide-react";
import type { Charge } from "@/api/schemas";
import { Badge } from "@/components/ui/Badge";
import { LOCATION_CLASS_LABEL, classifyLocation } from "@/lib/charging";

export function ChargeRow({ charge, onClick }: { charge: Charge; onClick: () => void }) {
  const locationClass = classifyLocation(charge.address);
  const avgKw = charge.duration_min > 0 ? charge.charge_energy_added / (charge.duration_min / 60) : 0;

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:bg-surface-raised sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <Badge tone="charge">{LOCATION_CLASS_LABEL[locationClass]}</Badge>
        <span className="truncate font-medium text-ink">{charge.address || "Unknown"}</span>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-3 text-xs text-ink-muted">
        <span>{format(new Date(charge.start_date), "MMM d, HH:mm")}</span>
        <span className="flex items-center gap-1 tabular-nums">
          <Clock className="h-3 w-3" /> {charge.duration_str}
        </span>
        <span className="flex items-center gap-1 tabular-nums">
          <Zap className="h-3 w-3" /> {charge.charge_energy_added.toFixed(1)} kWh · avg {avgKw.toFixed(0)} kW
        </span>
        <span className="tabular-nums">
          {charge.battery_details.start_battery_level}% → {charge.battery_details.end_battery_level}%
        </span>
        {charge.cost > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <DollarSign className="h-3 w-3" /> {charge.cost.toFixed(2)}
          </span>
        )}
      </div>
    </button>
  );
}
