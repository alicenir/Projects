import { format, parse } from "date-fns";
import { CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyStat } from "@/lib/trends";

export function ConsumptionVsTemp({ data }: { data: MonthlyStat[] }) {
  const rows = data.filter((m) => m.avgConsumption !== null || m.avgOutsideTemp !== null);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(v: string) => format(parse(v, "yyyy-MM", new Date()), "MMM")}
            tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
          />
          <YAxis
            yAxisId="consumption"
            tick={{ fontSize: 11, fill: "rgb(var(--efficiency))" }}
            label={{ value: "Wh/km", position: "insideLeft", fontSize: 11, fill: "rgb(var(--efficiency))" }}
          />
          <YAxis
            yAxisId="temp"
            orientation="right"
            tick={{ fontSize: 11, fill: "rgb(var(--battery))" }}
            label={{ value: "°C", position: "insideRight", fontSize: 11, fill: "rgb(var(--battery))" }}
          />
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
          <Line
            yAxisId="consumption"
            type="monotone"
            dataKey="avgConsumption"
            name="Avg consumption"
            stroke="rgb(var(--efficiency))"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="avgOutsideTemp"
            name="Avg outside temp"
            stroke="rgb(var(--battery))"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
