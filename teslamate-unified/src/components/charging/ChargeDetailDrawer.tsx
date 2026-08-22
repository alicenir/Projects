import { format } from "date-fns";
import { useChargeDetail } from "@/api/hooks";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChargeCurveChart } from "./ChargeCurveChart";

export function ChargeDetailDrawer({
  carId,
  chargeId,
  onClose,
}: {
  carId: number | null;
  chargeId: number | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error, refetch } = useChargeDetail(carId, chargeId);

  return (
    <Drawer open={chargeId !== null} onClose={onClose} title={data ? data.data.charge.address : "Charge detail"}>
      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      )}

      {isError && <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => refetch()} />}

      {data && (
        <div className="flex flex-col gap-5">
          <ChargeCurveChart samples={data.data.charge.charge_details} />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Energy added" value={`${data.data.charge.charge_energy_added.toFixed(1)} kWh`} />
            <Stat label="Duration" value={data.data.charge.duration_str} />
            <Stat
              label="Battery"
              value={`${data.data.charge.battery_details.start_battery_level}% → ${data.data.charge.battery_details.end_battery_level}%`}
            />
            {data.data.charge.cost > 0 && <Stat label="Cost" value={data.data.charge.cost.toFixed(2)} />}
            <Stat label="Started" value={format(new Date(data.data.charge.start_date), "MMM d, HH:mm")} />
            <Stat label="Ended" value={format(new Date(data.data.charge.end_date), "MMM d, HH:mm")} />
            {data.data.charge.outside_temp_avg !== 0 && (
              <Stat label="Outside temp" value={`${Math.round(data.data.charge.outside_temp_avg)}°`} />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-raised p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}
