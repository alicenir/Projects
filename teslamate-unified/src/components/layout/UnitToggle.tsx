import { useUnits } from "@/context/UnitsContext";
import { cn } from "@/lib/utils";

export function UnitToggle() {
  const { system, setSystem } = useUnits();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5 text-xs font-medium">
      <button
        onClick={() => setSystem("metric")}
        className={cn("rounded-full px-2.5 py-1", system === "metric" ? "bg-drive-soft text-drive" : "text-ink-muted hover:text-ink")}
      >
        km
      </button>
      <button
        onClick={() => setSystem("imperial")}
        className={cn("rounded-full px-2.5 py-1", system === "imperial" ? "bg-drive-soft text-drive" : "text-ink-muted hover:text-ink")}
      >
        mi
      </button>
    </div>
  );
}
