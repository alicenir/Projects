import { useChargesForRange, useDrivesForRange } from "@/api/hooks";
import { ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDateRange } from "@/context/DateRangeContext";
import { useUnits } from "@/context/UnitsContext";
import { useVehicle } from "@/context/VehicleContext";
import {
  computeKpiTotals,
  dailyMaxSparkline,
  dailyRatioSparkline,
  dailySparkline,
  percentDelta,
} from "@/lib/kpi";
import { displayDistance, type LengthUnit } from "@/lib/units";
import { KpiTile } from "./KpiTile";

export function KpiStrip() {
  const { carId } = useVehicle();
  const { startDate, endDate, previousRange } = useDateRange();
  const { system } = useUnits();

  const range = { startDate, endDate };
  const drivesQ = useDrivesForRange(carId, range);
  const chargesQ = useChargesForRange(carId, range);
  const prevDrivesQ = useDrivesForRange(previousRange ? carId : null, previousRange ?? {});
  const prevChargesQ = useChargesForRange(previousRange ? carId : null, previousRange ?? {});

  const isLoading = drivesQ.isLoading || chargesQ.isLoading;
  const isError = drivesQ.isError || chargesQ.isError;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (isError || !drivesQ.data || !chargesQ.data) {
    return (
      <ErrorState
        message={(drivesQ.error ?? chargesQ.error) instanceof Error ? (drivesQ.error ?? chargesQ.error)!.message : "Unknown error"}
        onRetry={() => {
          drivesQ.refetch();
          chargesQ.refetch();
        }}
      />
    );
  }

  const drives = drivesQ.data.drives;
  const charges = chargesQ.data;
  const lengthUnit = drivesQ.data.unitOfLength as LengthUnit;

  const totals = computeKpiTotals(drives, charges);
  const prevTotals =
    prevDrivesQ.data && prevChargesQ.data ? computeKpiTotals(prevDrivesQ.data.drives, prevChargesQ.data) : null;

  const distanceDisplay = displayDistance(totals.totalDistance, lengthUnit, system);
  const longestDisplay = displayDistance(totals.longestDrive, lengthUnit, system);
  const distUnit = system === "imperial" ? "mi" : "km";

  const distanceSpark = dailySparkline(drives, (d) => d.start_date, (d) => d.odometer_details.odometer_distance);
  const driveCountSpark = dailySparkline(drives, (d) => d.start_date, () => 1);
  const energySpark = dailySparkline(
    drives.filter((d) => d.energy_consumed_net !== null),
    (d) => d.start_date,
    (d) => d.energy_consumed_net!
  );
  const costSpark = dailySparkline(charges, (c) => c.start_date, (c) => c.cost);
  const co2Spark = distanceSpark.map((p) => ({ date: p.date, value: p.value * 0.2 }));
  const longestSpark = dailyMaxSparkline(drives, (d) => d.start_date, (d) => d.odometer_details.odometer_distance);
  const effSpark = dailyRatioSparkline(
    drives.filter((d) => d.energy_consumed_net !== null),
    (d) => d.start_date,
    (d) => d.energy_consumed_net! * 1000,
    (d) => d.odometer_details.odometer_distance
  );
  const fastestChargeSpark = dailyMaxSparkline(
    charges.filter((c) => c.duration_min > 0),
    (c) => c.start_date,
    (c) => c.charge_energy_added / (c.duration_min / 60)
  );

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiTile
        label="Distance"
        value={distanceDisplay.toFixed(0)}
        unit={distUnit}
        delta={prevTotals ? percentDelta(totals.totalDistance, prevTotals.totalDistance) : undefined}
        sparkline={distanceSpark}
        colorVar="--drive"
      />
      <KpiTile
        label="Drives"
        value={String(totals.driveCount)}
        delta={prevTotals ? percentDelta(totals.driveCount, prevTotals.driveCount) : undefined}
        sparkline={driveCountSpark}
        colorVar="--drive"
      />
      <KpiTile
        label="Energy used"
        value={totals.energyConsumedKwh.toFixed(0)}
        unit="kWh"
        delta={prevTotals ? percentDelta(totals.energyConsumedKwh, prevTotals.energyConsumedKwh) : undefined}
        deltaGoodDirection="down"
        sparkline={energySpark}
        colorVar="--efficiency"
      />
      <KpiTile
        label="Charging cost"
        value={totals.totalChargeCost.toFixed(0)}
        delta={prevTotals ? percentDelta(totals.totalChargeCost, prevTotals.totalChargeCost) : undefined}
        deltaGoodDirection="down"
        sparkline={costSpark}
        colorVar="--charge"
      />
      <KpiTile
        label="Avg efficiency"
        value={totals.avgEfficiencyWhPerKm !== null ? totals.avgEfficiencyWhPerKm.toFixed(0) : "—"}
        unit="Wh/km"
        delta={
          prevTotals?.avgEfficiencyWhPerKm != null && totals.avgEfficiencyWhPerKm !== null
            ? percentDelta(totals.avgEfficiencyWhPerKm, prevTotals.avgEfficiencyWhPerKm)
            : undefined
        }
        deltaGoodDirection="down"
        sparkline={effSpark}
        colorVar="--efficiency"
      />
      <KpiTile
        label="CO2 avoided (est.)"
        value={totals.co2AvoidedKg.toFixed(0)}
        unit="kg"
        delta={prevTotals ? percentDelta(totals.co2AvoidedKg, prevTotals.co2AvoidedKg) : undefined}
        sparkline={co2Spark}
        colorVar="--charge"
      />
      <KpiTile
        label="Longest drive"
        value={longestDisplay.toFixed(0)}
        unit={distUnit}
        delta={prevTotals ? percentDelta(totals.longestDrive, prevTotals.longestDrive) : undefined}
        sparkline={longestSpark}
        colorVar="--drive"
      />
      <KpiTile
        label="Fastest charge (avg)"
        value={totals.fastestChargeAvgKw !== null ? totals.fastestChargeAvgKw.toFixed(0) : "—"}
        unit="kW"
        delta={
          prevTotals?.fastestChargeAvgKw != null && totals.fastestChargeAvgKw !== null
            ? percentDelta(totals.fastestChargeAvgKw, prevTotals.fastestChargeAvgKw)
            : undefined
        }
        sparkline={fastestChargeSpark}
        colorVar="--battery"
      />
    </div>
  );
}
