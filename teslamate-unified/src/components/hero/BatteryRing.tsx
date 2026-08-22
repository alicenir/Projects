import { motion, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = 168;
const STROKE = 12;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function toneFor(level: number) {
  if (level >= 50) return { stroke: "rgb(var(--charge))", text: "text-charge" };
  if (level >= 20) return { stroke: "rgb(var(--battery))", text: "text-battery" };
  return { stroke: "rgb(var(--alert))", text: "text-alert" };
}

export function BatteryRing({
  level,
  limit,
  charging,
}: {
  level: number | null;
  limit: number | null;
  charging: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, level ?? 0));
  const tone = toneFor(clamped);
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="relative flex-none" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
          className="stroke-surface-raised"
        />
        {limit !== null && limit > 0 && limit < 100 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            strokeWidth={STROKE + 4}
            fill="none"
            stroke="currentColor"
            className="text-ink-muted/40"
            strokeDasharray={`1 ${(CIRCUMFERENCE * limit) / 100 - 1}`}
            strokeDashoffset={-((CIRCUMFERENCE * limit) / 100) + 1}
            strokeLinecap="round"
          />
        )}
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          fill="none"
          stroke={tone.stroke}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={reduceMotion ? { strokeDashoffset: offset } : { strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduceMotion ? 0 : 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {charging && (
          <Zap className={cn("absolute -top-1 h-5 w-5 animate-pulse-soft", tone.text)} fill="currentColor" />
        )}
        <span className={cn("text-4xl font-bold tabular-nums", tone.text)}>
          {level !== null ? Math.round(level) : "—"}
          <span className="text-lg">%</span>
        </span>
        {limit !== null && <span className="text-xs text-ink-muted">limit {Math.round(limit)}%</span>}
      </div>
    </div>
  );
}
