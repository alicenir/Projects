import { format } from "date-fns";
import { CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { ChargeDetailSample } from "@/api/schemas";

export function ChargeCurveChart({ samples }: { samples: ChargeDetailSample[] }) {
  if (samples.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl bg-surface-raised text-xs text-ink-muted">
        Not enough samples for a curve
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={samples} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => format(new Date(v), "HH:mm")}
            tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
            minTickGap={40}
          />
          <YAxis
            yAxisId="power"
            tick={{ fontSize: 11, fill: "rgb(var(--efficiency))" }}
            label={{ value: "kW", position: "insideLeft", fontSize: 11, fill: "rgb(var(--efficiency))" }}
          />
          <YAxis
            yAxisId="soc"
            orientation="right"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "rgb(var(--charge))" }}
            label={{ value: "%", position: "insideRight", fontSize: 11, fill: "rgb(var(--charge))" }}
          />
          <Tooltip
            labelFormatter={(v) => (typeof v === "string" ? format(new Date(v), "HH:mm:ss") : "")}
            contentStyle={{
              background: "rgb(var(--surface-raised))",
              border: "1px solid rgb(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="power"
            type="monotone"
            dataKey="charger_details.charger_power"
            name="Power (kW)"
            stroke="rgb(var(--efficiency))"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="soc"
            type="monotone"
            dataKey="battery_level"
            name="Battery (%)"
            stroke="rgb(var(--charge))"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
