import { useState } from "react";
import { format, parse } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyStat } from "@/lib/trends";
import { cn } from "@/lib/utils";

type Metric = "distance" | "energyKwh" | "cost";
const METRICS: { key: Metric; label: string; colorVar: string }[] = [
  { key: "distance", label: "Distance", colorVar: "--drive" },
  { key: "energyKwh", label: "Energy", colorVar: "--efficiency" },
  { key: "cost", label: "Cost", colorVar: "--charge" },
];

export function MonthlyBarChart({ data }: { data: MonthlyStat[] }) {
  const [metric, setMetric] = useState<Metric>("distance");
  const active = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-0.5 self-start rounded-full border border-border p-0.5 text-xs font-medium">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={cn("rounded-full px-2.5 py-1", metric === m.key ? "bg-drive-soft text-drive" : "text-ink-muted hover:text-ink")}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={(v: string) => format(parse(v, "yyyy-MM", new Date()), "MMM")}
              tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
            />
            <YAxis tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }} />
            <Tooltip
              labelFormatter={(v) => (typeof v === "string" ? format(parse(v, "yyyy-MM", new Date()), "MMMM yyyy") : "")}
              formatter={(value) => [typeof value === "number" ? value.toFixed(1) : value, active.label]}
              contentStyle={{
                background: "rgb(var(--surface-raised))",
                border: "1px solid rgb(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey={metric} fill={`rgb(var(${active.colorVar}))`} radius={[4, 4, 0, 0]} isAnimationActive />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
