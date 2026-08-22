import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useDateRange } from "@/context/DateRangeContext";
import { DriveDetailDrawer } from "./DriveDetailDrawer";
import { DriveFilters, type DriveFilterValues } from "./DriveFilters";
import { DrivesList } from "./DrivesList";
import { EfficiencyScatter } from "./EfficiencyScatter";

export function DrivesSection({ carId }: { carId: number }) {
  const { startDate, endDate } = useDateRange();
  const [filters, setFilters] = useState<DriveFilterValues>({});
  const [selectedDriveId, setSelectedDriveId] = useState<number | null>(null);

  const range = { startDate, endDate };

  return (
    <section className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-wrap items-start gap-3 sm:items-center">
            <CardTitle>Drives</CardTitle>
            <DriveFilters value={filters} onChange={setFilters} />
          </CardHeader>
          <CardContent>
            <DrivesList carId={carId} range={range} filters={filters} onSelect={setSelectedDriveId} />
          </CardContent>
        </Card>

        <EfficiencyScatter carId={carId} range={range} />
      </div>

      <DriveDetailDrawer carId={carId} driveId={selectedDriveId} onClose={() => setSelectedDriveId(null)} />
    </section>
  );
}
