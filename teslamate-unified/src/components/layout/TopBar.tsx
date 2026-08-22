import { Zap } from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";
import { DateRangePicker } from "./DateRangePicker";
import { ThemeToggle } from "./ThemeToggle";
import { UnitToggle } from "./UnitToggle";
import { VehicleSelect } from "./VehicleSelect";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 pr-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-drive-soft text-drive">
            <Zap className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-ink">TeslaMate Unified</span>
        </div>

        <VehicleSelect />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <UnitToggle />
          <ThemeToggle />
          <ConnectionStatus />
        </div>
      </div>
    </header>
  );
}
