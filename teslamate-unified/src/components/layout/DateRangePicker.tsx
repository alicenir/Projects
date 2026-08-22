import { PRESET_LABELS, useDateRange, type DateRangePreset } from "@/context/DateRangeContext";
import { cn } from "@/lib/utils";

const PRESETS: DateRangePreset[] = ["7d", "30d", "90d", "ytd", "all"];

export function DateRangePicker() {
  const { preset, setPreset } = useDateRange();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
      {PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => setPreset(p)}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            preset === p ? "bg-drive-soft text-drive" : "text-ink-muted hover:text-ink"
          )}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
