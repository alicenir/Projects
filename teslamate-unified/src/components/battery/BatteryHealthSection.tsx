import { useBatteryHealth, useChargesForRange } from "@/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { computeCareStats } from "@/lib/batteryHealth";
import { CareScoreGauge } from "./CareScoreGauge";
import { DegradationChart } from "./DegradationChart";

export function BatteryHealthSection({ carId }: { carId: number }) {
  const healthQ = useBatteryHealth(carId);
  // Deliberately all-time (empty range), not bound to the top date picker —
  // a degradation trend over the currently-selected 7/30/90 day window is
  // essentially flat and not useful; this needs the car's whole history.
  const chargesQ = useChargesForRange(carId, {});

  const isLoading = healthQ.isLoading || chargesQ.isLoading;
  const isError = healthQ.isError || chargesQ.isError;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Battery health</h2>
        <span className="text-xs text-ink-muted">All-time — independent of the date range above</span>
      </div>

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      )}

      {isError && (
        <ErrorState
          message={(healthQ.error ?? chargesQ.error) instanceof Error ? (healthQ.error ?? chargesQ.error)!.message : "Unknown error"}
          onRetry={() => {
            healthQ.refetch();
            chargesQ.refetch();
          }}
        />
      )}

      {healthQ.data && chargesQ.data && (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <Card>
            <CardHeader>
              <CardTitle>Current estimate</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Health" value={`${healthQ.data.data.battery_health.battery_health_percentage.toFixed(0)}%`} />
                <Stat label="Max capacity" value={`${healthQ.data.data.battery_health.max_capacity.toFixed(1)} kWh`} />
                <Stat label="Current range" value={`${healthQ.data.data.battery_health.current_range.toFixed(0)} ${healthQ.data.data.units.unit_of_length}`} />
                <Stat label="Max range" value={`${healthQ.data.data.battery_health.max_range.toFixed(0)} ${healthQ.data.data.units.unit_of_length}`} />
              </div>

              {(() => {
                const care = computeCareStats(chargesQ.data, healthQ.data!.data.battery_health.current_capacity);
                return (
                  <>
                    <CareScoreGauge score={care.careScore} />
                    <div className="grid grid-cols-2 gap-3 text-xs text-ink-muted">
                      <span>~{care.approxCycles !== null ? care.approxCycles.toFixed(0) : "—"} cycles (approx.)</span>
                      <span>{care.pctSessionsAbove95.toFixed(0)}% sessions end &gt;95%</span>
                      <span>avg start {care.avgSessionStartSoc.toFixed(0)}%</span>
                      <span>{care.pctSessionsBelow20Start.toFixed(0)}% sessions start &lt;20%</span>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rated range @ 100%, over time</CardTitle>
            </CardHeader>
            <CardContent>
              <DegradationChart charges={chargesQ.data} />
            </CardContent>
          </Card>
        </div>
      )}
    </section>
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
