import { format } from "date-fns";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { computeRangeAt100, linearRegression } from "@/lib/batteryHealth";
import type { Charge } from "@/api/schemas";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrendingDown } from "lucide-react";

export function DegradationChart({ charges }: { charges: Charge[] }) {
  const points = computeRangeAt100(charges);

  if (points.length < 3) {
    return (
      <EmptyState
        icon={<TrendingDown className="h-6 w-6" />}
        title="Not enough near-full charges yet"
        description="Needs a handful of charges ending at 90%+ SoC to estimate a trend."
      />
    );
  }

  const regression = linearRegression(points.map((p) => ({ x: p.timestamp, y: p.rangeAt100 })));
  const trendLine = regression
    ? [
        { timestamp: points[0].timestamp, trend: regression.predict(points[0].timestamp) },
        { timestamp: points[points.length - 1].timestamp, trend: regression.predict(points[points.length - 1].timestamp) },
      ]
    : [];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => format(new Date(v), "MMM yyyy")}
            tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
          />
          <YAxis
            dataKey="rangeAt100"
            domain={["dataMin - 10", "dataMax + 10"]}
            tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
            label={{ value: "range @ 100%", angle: -90, position: "insideLeft", fontSize: 11, fill: "rgb(var(--ink-muted))" }}
          />
          <Tooltip
            labelFormatter={(v) => (typeof v === "number" ? format(new Date(v), "MMM d, yyyy") : "")}
            formatter={(value, name) => [typeof value === "number" ? value.toFixed(0) : value, name === "trend" ? "Trend" : "Estimate"]}
            contentStyle={{
              background: "rgb(var(--surface-raised))",
              border: "1px solid rgb(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Scatter name="Estimate" data={points} fill="rgb(var(--battery))" />
          {trendLine.length > 0 && (
            <Line
              name="trend"
              data={trendLine}
              dataKey="trend"
              stroke="rgb(var(--alert))"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
