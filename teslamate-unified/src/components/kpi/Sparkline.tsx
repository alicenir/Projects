import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { SparklinePoint } from "@/lib/kpi";

export function Sparkline({ data, colorVar }: { data: SparklinePoint[]; colorVar: string }) {
  if (data.length < 2) return <div className="h-10" />;

  const gradientId = `spark-${colorVar.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`rgb(var(${colorVar}))`} stopOpacity={0.35} />
              <stop offset="100%" stopColor={`rgb(var(${colorVar}))`} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={`rgb(var(${colorVar}))`}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive
            animationDuration={600}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
