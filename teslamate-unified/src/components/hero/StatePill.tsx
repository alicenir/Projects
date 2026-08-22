import { Badge } from "@/components/ui/Badge";

const STATE_TONE: Record<string, { tone: "neutral" | "drive" | "charge" | "battery" | "alert"; pulse: boolean }> = {
  driving: { tone: "drive", pulse: true },
  charging: { tone: "charge", pulse: true },
  online: { tone: "neutral", pulse: false },
  asleep: { tone: "neutral", pulse: false },
  suspended: { tone: "battery", pulse: false },
  offline: { tone: "alert", pulse: false },
};

export function StatePill({ state }: { state: string }) {
  const key = state.toLowerCase();
  const { tone, pulse } = STATE_TONE[key] ?? { tone: "neutral" as const, pulse: false };
  const label = state ? state.charAt(0).toUpperCase() + state.slice(1) : "Unknown";

  return (
    <Badge tone={tone} pulse={pulse}>
      {label}
    </Badge>
  );
}
