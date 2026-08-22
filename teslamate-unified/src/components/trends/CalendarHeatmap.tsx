import { eachDayOfInterval, format, getDay, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import type { Drive } from "@/api/schemas";
import { dailyDistance } from "@/lib/trends";
import { cn } from "@/lib/utils";

const LEVEL_CLASSES = ["bg-surface-raised", "bg-drive/20", "bg-drive/40", "bg-drive/65", "bg-drive"];
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

export function CalendarHeatmap({ drives, from, to }: { drives: Drive[]; from: Date; to: Date }) {
  const [hovered, setHovered] = useState<{ date: string; value: number } | null>(null);

  const { weeks, max } = useMemo(() => {
    const byDay = dailyDistance(drives);
    const gridStart = startOfWeek(from, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: to });
    const max = Math.max(1, ...Array.from(byDay.values()));

    const weeks: { date: Date; value: number }[][] = [];
    let currentWeek: { date: Date; value: number }[] = [];
    for (const day of days) {
      const key = format(day, "yyyy-MM-dd");
      currentWeek.push({ date: day, value: byDay.get(key) ?? 0 });
      if (getDay(day) === 0) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);
    return { weeks, max };
  }, [drives, from, to]);

  function levelFor(value: number) {
    if (value <= 0) return 0;
    const ratio = value / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        <div className="flex flex-col gap-[3px] pr-1">
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={i} className="h-[11px] text-[9px] leading-[11px] text-ink-muted">
              {label}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map(({ date, value }) => {
              const key = format(date, "yyyy-MM-dd");
              return (
                <div
                  key={key}
                  onMouseEnter={() => setHovered({ date: key, value })}
                  onMouseLeave={() => setHovered(null)}
                  className={cn("h-[11px] w-[11px] rounded-[2px]", LEVEL_CLASSES[levelFor(value)])}
                  title={`${key}: ${value.toFixed(1)}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-ink-muted">
        <span>{hovered ? `${hovered.date} · ${hovered.value.toFixed(1)}` : "Hover a day"}</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {LEVEL_CLASSES.map((c, i) => (
            <div key={i} className={cn("h-[10px] w-[10px] rounded-[2px]", c)} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
