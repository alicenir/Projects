import { format, parse } from "date-fns";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChargesForRange } from "@/api/hooks";
import type { DateRangeParams } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { monthlyCostBreakdown } from "@/lib/charging";
import { PiggyBank } from "lucide-react";

export function CostBreakdownChart({ carId, range }: { carId: number | null; range: DateRangeParams }) {
  const { data, isLoading, isError, error, refetch } = useChargesForRange(carId, range);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost by month</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-56" />}
        {isError && <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => refetch()} />}
        {data &&
          (() => {
            const monthly = monthlyCostBreakdown(data);
            if (monthly.length === 0 || monthly.every((m) => m.home + m.public === 0)) {
              return (
                <EmptyState
                  icon={<PiggyBank className="h-6 w-6" />}
                  title="No charging cost recorded"
                  description="Cost data comes from TeslaMate's electricity price settings."
                />
              );
            }
            return (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(v: string) => format(parse(v, "yyyy-MM", new Date()), "MMM")}
                      tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }} />
                    <Tooltip
                      labelFormatter={(v) => (typeof v === "string" ? format(parse(v, "yyyy-MM", new Date()), "MMMM yyyy") : "")}
                      contentStyle={{
                        background: "rgb(var(--surface-raised))",
                        border: "1px solid rgb(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="home" name="Home" stackId="cost" fill="rgb(var(--charge))" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="public" name="Public" stackId="cost" fill="rgb(var(--efficiency))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
      </CardContent>
    </Card>
  );
}
