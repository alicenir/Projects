import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { SparklinePoint } from "@/lib/kpi";
import { Sparkline } from "./Sparkline";

export function KpiTile({
  label,
  value,
  unit,
  delta,
  deltaGoodDirection = "up",
  sparkline,
  colorVar = "--drive",
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  deltaGoodDirection?: "up" | "down";
  sparkline: SparklinePoint[];
  colorVar?: string;
}) {
  const showDelta = delta !== undefined && delta !== null && Number.isFinite(delta);
  const isGood = showDelta && (deltaGoodDirection === "up" ? delta! >= 0 : delta! <= 0);

  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        {showDelta && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-semibold tabular-nums",
              isGood ? "text-charge" : "text-alert"
            )}
          >
            {delta! >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta!).toFixed(0)}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums text-ink">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-ink-muted">{unit}</span>}
      </div>
      <Sparkline data={sparkline} colorVar={colorVar} />
    </Card>
  );
}
