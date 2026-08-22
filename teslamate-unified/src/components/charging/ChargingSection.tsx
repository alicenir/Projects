import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useDateRange } from "@/context/DateRangeContext";
import { ChargeDetailDrawer } from "./ChargeDetailDrawer";
import { ChargesList } from "./ChargesList";
import { CostBreakdownChart } from "./CostBreakdownChart";
import { LocationLeaderboard } from "./LocationLeaderboard";

export function ChargingSection({ carId }: { carId: number }) {
  const { startDate, endDate } = useDateRange();
  const [selectedChargeId, setSelectedChargeId] = useState<number | null>(null);

  const range = { startDate, endDate };

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Charging sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <ChargesList carId={carId} range={range} onSelect={setSelectedChargeId} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <CostBreakdownChart carId={carId} range={range} />
          <LocationLeaderboard carId={carId} range={range} />
        </div>
      </div>

      <ChargeDetailDrawer carId={carId} chargeId={selectedChargeId} onClose={() => setSelectedChargeId(null)} />
    </section>
  );
}
