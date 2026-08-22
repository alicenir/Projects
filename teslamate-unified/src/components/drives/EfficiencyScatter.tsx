import { CartesianGrid, Legend, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { ResponsiveContainer } from "recharts";
import { useDrivesForRange } from "@/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DateRangeParams } from "@/api/client";
import { useUnits } from "@/context/UnitsContext";
import { displayTemp, type TempUnit } from "@/lib/units";
import { TrendingUp } from "lucide-react";

const SEASONS = [
  { key: "winter", months: [11, 0, 1], color: "--drive" },
  { key: "spring", months: [2, 3, 4], color: "--charge" },
  { key: "summer", months: [5, 6, 7], color: "--battery" },
  { key: "autumn", months: [8, 9, 10], color: "--alert" },
] as const;

function seasonFor(month: number) {
  return SEASONS.find((s) => (s.months as readonly number[]).includes(month)) ?? SEASONS[0];
}

export function EfficiencyScatter({ carId, range }: { carId: number | null; range: DateRangeParams }) {
  const { data, isLoading, isError, error, refetch } = useDrivesForRange(carId, range);
  const { system } = useUnits();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Efficiency vs. temperature</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-72" />}
        {isError && <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => refetch()} />}
        {data && (() => {
          const tempUnit = "C" as TempUnit; // outside_temp_avg is always reported in °C by TeslaMate regardless of unit_of_temperature setting for this field in the drives payload
          const points = data.drives
            .filter((d) => d.outside_temp_avg !== null && d.consumption_net !== null)
            .map((d) => ({
              temp: displayTemp(d.outside_temp_avg!, tempUnit, system),
              consumption: d.consumption_net!,
              season: seasonFor(new Date(d.start_date).getMonth()).key,
              id: d.drive_id,
            }));

          if (points.length === 0) {
            return (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6" />}
                title="Not enough data yet"
                description="Needs drives with both outside temperature and net consumption recorded."
              />
            );
          }

          return (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" />
                  <XAxis
                    type="number"
                    dataKey="temp"
                    name="Outside temp"
                    unit={system === "imperial" ? "°F" : "°C"}
                    tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
                  />
                  <YAxis type="number" dataKey="consumption" name="Consumption" unit=" Wh/km" tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }} />
                  <ZAxis range={[40, 40]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "rgb(var(--surface-raised))",
                      border: "1px solid rgb(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {SEASONS.map((season) => (
                    <Scatter
                      key={season.key}
                      name={season.key}
                      data={points.filter((p) => p.season === season.key)}
                      fill={`rgb(var(${season.color}))`}
                      isAnimationActive
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
