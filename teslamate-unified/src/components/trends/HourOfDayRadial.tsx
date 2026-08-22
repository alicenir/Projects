import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Drive } from "@/api/schemas";
import { drivesByHourOfDay } from "@/lib/trends";

export function HourOfDayRadial({ drives }: { drives: Drive[] }) {
  const data = drivesByHourOfDay(drives);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="rgb(var(--border))" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 9, fill: "rgb(var(--ink-muted))" }} />
          <PolarRadiusAxis tick={{ fontSize: 9, fill: "rgb(var(--ink-muted))" }} axisLine={false} />
          <Tooltip
            formatter={(value) => [`${value} drives`, ""]}
            labelFormatter={(v) => `${v}`}
            contentStyle={{
              background: "rgb(var(--surface-raised))",
              border: "1px solid rgb(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Radar dataKey="count" stroke="rgb(var(--drive))" fill="rgb(var(--drive))" fillOpacity={0.35} isAnimationActive />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
