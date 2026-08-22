import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChargesForRange } from "@/api/hooks";
import type { DateRangeParams } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { LOCATION_CLASS_COLOR, summarizeLocations } from "@/lib/charging";
import { MapPinned } from "lucide-react";

export function LocationLeaderboard({ carId, range }: { carId: number | null; range: DateRangeParams }) {
  const { data, isLoading, isError, error, refetch } = useChargesForRange(carId, range);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top charging locations</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-64" />}
        {isError && <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => refetch()} />}
        {data &&
          (() => {
            const locations = summarizeLocations(data).slice(0, 8);
            if (locations.length === 0) {
              return <EmptyState icon={<MapPinned className="h-6 w-6" />} title="No charging locations yet" />;
            }
            return (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={locations}
                    margin={{ top: 4, right: 24, bottom: 4, left: 4 }}
                    barCategoryGap={10}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }} unit=" kWh" />
                    <YAxis
                      type="category"
                      dataKey="address"
                      width={110}
                      tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
                      tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        typeof value === "number" ? `${value.toFixed(1)} kWh` : String(value),
                        name,
                      ]}
                      labelFormatter={(v) => v}
                      contentStyle={{
                        background: "rgb(var(--surface-raised))",
                        border: "1px solid rgb(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="energyKwh" name="Energy" radius={[0, 4, 4, 0]}>
                      {locations.map((loc) => (
                        <Cell key={loc.address} fill={`rgb(var(${LOCATION_CLASS_COLOR[loc.locationClass]}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
      </CardContent>
    </Card>
  );
}
