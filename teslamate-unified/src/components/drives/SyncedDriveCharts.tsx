import { format } from "date-fns";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DriveDetailPoint } from "@/api/schemas";

const SYNC_ID = "drive-detail";

function MiniLineChart({
  data,
  dataKey,
  label,
  colorVar,
  unit,
}: {
  data: DriveDetailPoint[];
  dataKey: keyof DriveDetailPoint;
  label: string;
  colorVar: string;
  unit: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="h-24 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} syncId={SYNC_ID} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => format(new Date(v), "HH:mm")}
              tick={{ fontSize: 10, fill: "rgb(var(--ink-muted))" }}
              minTickGap={40}
            />
            <YAxis width={32} tick={{ fontSize: 10, fill: "rgb(var(--ink-muted))" }} />
            <Tooltip
              labelFormatter={(v) => (typeof v === "string" ? format(new Date(v), "HH:mm:ss") : "")}
              formatter={(value) => [typeof value === "number" ? `${Math.round(value)} ${unit}` : "—", label]}
              contentStyle={{
                background: "rgb(var(--surface-raised))",
                border: "1px solid rgb(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={`rgb(var(${colorVar}))`}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function SyncedDriveCharts({ points }: { points: DriveDetailPoint[] }) {
  if (points.length < 2) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <MiniLineChart data={points} dataKey="speed" label="Speed" colorVar="--drive" unit="km/h" />
      <MiniLineChart data={points} dataKey="power" label="Power" colorVar="--efficiency" unit="kW" />
      <MiniLineChart data={points} dataKey="battery_level" label="Battery" colorVar="--charge" unit="%" />
      <MiniLineChart data={points} dataKey="elevation" label="Elevation" colorVar="--battery" unit="m" />
    </div>
  );
}
