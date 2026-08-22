import { subDays } from "date-fns";
import { useChargesForRange, useDrivesForRange } from "@/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDateRange } from "@/context/DateRangeContext";
import { monthlyStats } from "@/lib/trends";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { ConsumptionVsTemp } from "./ConsumptionVsTemp";
import { HourOfDayRadial } from "./HourOfDayRadial";
import { MonthlyBarChart } from "./MonthlyBarChart";

export function TrendsSection({ carId }: { carId: number }) {
  const { startDate, endDate } = useDateRange();
  const range = { startDate, endDate };

  const drivesQ = useDrivesForRange(carId, range);
  const chargesQ = useChargesForRange(carId, range);

  const isLoading = drivesQ.isLoading || chargesQ.isLoading;
  const isError = drivesQ.isError || chargesQ.isError;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-ink">Trends & patterns</h2>

      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      )}

      {isError && (
        <ErrorState
          message={(drivesQ.error ?? chargesQ.error) instanceof Error ? (drivesQ.error ?? chargesQ.error)!.message : "Unknown error"}
          onRetry={() => {
            drivesQ.refetch();
            chargesQ.refetch();
          }}
        />
      )}

      {drivesQ.data && chargesQ.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Daily distance</CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarHeatmap
                drives={drivesQ.data.drives}
                from={startDate ? new Date(startDate) : subDays(new Date(), 90)}
                to={endDate ? new Date(endDate) : new Date()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Drives by hour of day</CardTitle>
            </CardHeader>
            <CardContent>
              <HourOfDayRadial drives={drivesQ.data.drives} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly totals</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyBarChart data={monthlyStats(drivesQ.data.drives, chargesQ.data)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consumption vs. temperature</CardTitle>
            </CardHeader>
            <CardContent>
              <ConsumptionVsTemp data={monthlyStats(drivesQ.data.drives, chargesQ.data)} />
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
