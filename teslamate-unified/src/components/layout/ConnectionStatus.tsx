import { usePing } from "@/api/hooks";
import { cn } from "@/lib/utils";

export function ConnectionStatus() {
  const { isLoading, isError } = usePing();

  const tone = isLoading ? "amber" : isError ? "red" : "green";
  const label = isLoading ? "Connecting…" : isError ? "TeslaMateAPI unreachable" : "Connected";

  return (
    <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5" title={label}>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          tone === "green" && "bg-charge animate-pulse-soft",
          tone === "amber" && "bg-battery animate-pulse-soft",
          tone === "red" && "bg-alert"
        )}
      />
      <span className="hidden text-xs text-ink-muted sm:inline">{label}</span>
    </div>
  );
}
