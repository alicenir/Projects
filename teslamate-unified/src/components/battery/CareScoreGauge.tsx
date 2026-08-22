import { cn } from "@/lib/utils";

function toneFor(score: number) {
  if (score >= 80) return "text-charge bg-charge";
  if (score >= 60) return "text-battery bg-battery";
  return "text-alert bg-alert";
}

export function CareScoreGauge({ score }: { score: number }) {
  const [textTone, barTone] = toneFor(score).split(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Battery care score</span>
        <span className={cn("text-lg font-bold tabular-nums", textTone)}>{score}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
        <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
