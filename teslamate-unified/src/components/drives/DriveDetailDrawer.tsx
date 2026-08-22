import { lazy, Suspense } from "react";
import { format } from "date-fns";
import { useDriveDetail } from "@/api/hooks";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUnits } from "@/context/UnitsContext";
import { displayDistance, formatSpeed, type LengthUnit } from "@/lib/units";
import { SyncedDriveCharts } from "./SyncedDriveCharts";

const RouteMap = lazy(() => import("./RouteMap").then((m) => ({ default: m.RouteMap })));

export function DriveDetailDrawer({
  carId,
  driveId,
  onClose,
}: {
  carId: number | null;
  driveId: number | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error, refetch } = useDriveDetail(carId, driveId);
  const { system } = useUnits();

  return (
    <Drawer open={driveId !== null} onClose={onClose} title={data ? `${data.data.drive.start_address} → ${data.data.drive.end_address}` : "Drive detail"}>
      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      )}

      {isError && <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => refetch()} />}

      {data && (
        <div className="flex flex-col gap-5">
          <Suspense fallback={<Skeleton className="h-full min-h-[220px] w-full" />}>
            <RouteMap points={data.data.drive.drive_details} />
          </Suspense>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Distance" value={`${displayDistance(data.data.drive.odometer_details.odometer_distance, data.data.units.unit_of_length as LengthUnit, system).toFixed(1)} ${system === "imperial" ? "mi" : "km"}`} />
            <Stat label="Duration" value={data.data.drive.duration_str} />
            <Stat label="Avg / Max speed" value={`${formatSpeed(data.data.drive.speed_avg, data.data.units.unit_of_length as LengthUnit, system)} / ${formatSpeed(data.data.drive.speed_max, data.data.units.unit_of_length as LengthUnit, system)}`} />
            <Stat
              label="Battery"
              value={`${data.data.drive.battery_details.start_battery_level}% → ${data.data.drive.battery_details.end_battery_level}%`}
            />
            {data.data.drive.consumption_net !== null && (
              <Stat label="Efficiency" value={`${Math.round(data.data.drive.consumption_net)} Wh/km`} />
            )}
            {data.data.drive.outside_temp_avg !== null && (
              <Stat label="Outside temp" value={`${Math.round(data.data.drive.outside_temp_avg)}°`} />
            )}
            <Stat label="Started" value={format(new Date(data.data.drive.start_date), "MMM d, HH:mm")} />
            <Stat label="Ended" value={format(new Date(data.data.drive.end_date), "MMM d, HH:mm")} />
          </div>

          <SyncedDriveCharts points={data.data.drive.drive_details} />
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
