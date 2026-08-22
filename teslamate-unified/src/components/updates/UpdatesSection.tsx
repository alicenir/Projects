import { differenceInDays, format } from "date-fns";
import { Rocket } from "lucide-react";
import { useCar, useUpdates } from "@/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

export function UpdatesSection({ carId }: { carId: number }) {
  const updatesQ = useUpdates(carId);
  const carQ = useCar(carId);
  const car = carQ.data?.data.cars[0];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">Updates & vehicle info</h2>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Firmware timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {updatesQ.isLoading && <Skeleton className="h-56" />}
            {updatesQ.isError && (
              <ErrorState message={updatesQ.error instanceof Error ? updatesQ.error.message : "Unknown error"} onRetry={() => updatesQ.refetch()} />
            )}
            {updatesQ.data &&
              (() => {
                const updates = [...updatesQ.data.data.updates].sort(
                  (a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
                );
                if (updates.length === 0) {
                  return <EmptyState icon={<Rocket className="h-6 w-6" />} title="No updates recorded yet" />;
                }
                return (
                  <ol className="flex flex-col gap-3">
                    {updates.map((u, i) => {
                      const prev = updates[i + 1];
                      const daysSince = prev ? Math.abs(differenceInDays(new Date(u.start_date), new Date(prev.start_date))) : null;
                      return (
                        <li key={u.update_id} className="flex items-center gap-3 rounded-xl bg-surface-raised p-3">
                          <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-drive-soft text-drive">
                            <Rocket className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-ink">{u.version}</div>
                            <div className="text-xs text-ink-muted">{format(new Date(u.start_date), "MMM d, yyyy · HH:mm")}</div>
                          </div>
                          {daysSince !== null && <span className="flex-none text-xs text-ink-muted">+{daysSince}d</span>}
                        </li>
                      );
                    })}
                  </ol>
                );
              })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle</CardTitle>
          </CardHeader>
          <CardContent>
            {carQ.isLoading && <Skeleton className="h-56" />}
            {carQ.isError && (
              <ErrorState message={carQ.error instanceof Error ? carQ.error.message : "Unknown error"} onRetry={() => carQ.refetch()} />
            )}
            {car && (
              <div className="grid grid-cols-2 gap-3">
                <Spec label="Model" value={car.car_details.model ?? "—"} />
                <Spec label="Trim" value={car.car_details.trim_badging ?? "—"} />
                <Spec label="VIN" value={car.car_details.vin} />
                <Spec label="Color" value={car.car_exterior.exterior_color ?? "—"} />
                <Spec label="Wheels" value={car.car_exterior.wheel_type ?? "—"} />
                <Spec label="Efficiency" value={car.car_details.efficiency !== null ? `${car.car_details.efficiency.toFixed(0)} Wh/km` : "—"} />
                <Spec label="Tracked since" value={format(new Date(car.teslamate_details.inserted_at), "MMM yyyy")} />
                <Spec label="Total drives" value={String(car.teslamate_stats.total_drives)} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-raised p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
