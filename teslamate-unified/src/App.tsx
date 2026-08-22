import { lazy, Suspense } from "react";
import { DateRangeProvider } from "@/context/DateRangeContext";
import { UnitsProvider } from "@/context/UnitsContext";
import { VehicleProvider, useVehicle } from "@/context/VehicleContext";
import { TopBar } from "@/components/layout/TopBar";
import { HeroPanel } from "@/components/hero/HeroPanel";
import { KpiStrip } from "@/components/kpi/KpiStrip";
import { DrivesSection } from "@/components/drives/DrivesSection";
import { ChargingSection } from "@/components/charging/ChargingSection";
import { BatteryHealthSection } from "@/components/battery/BatteryHealthSection";
import { TrendsSection } from "@/components/trends/TrendsSection";
import { UpdatesSection } from "@/components/updates/UpdatesSection";
import { useDateRange } from "@/context/DateRangeContext";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

const FullMapView = lazy(() => import("@/components/map/FullMapView").then((m) => ({ default: m.FullMapView })));

function Dashboard() {
  const { carId, cars, isLoading, isError } = useVehicle();
  const { startDate, endDate } = useDateRange();

  return (
    <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
      {isLoading && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      )}

      {isError && (
        <ErrorState message="Couldn't reach TeslaMateAPI. Check TESLAMATE_API_URL and that the proxy is running." />
      )}

      {!isLoading && !isError && cars.length === 0 && (
        <EmptyState
          title="No cars found"
          description="TeslaMateAPI connected, but /api/v1/cars returned no vehicles yet."
        />
      )}

      {carId !== null && (
        <>
          <HeroPanel carId={carId} />
          <KpiStrip />
          <DrivesSection carId={carId} />
          <ChargingSection carId={carId} />
          <BatteryHealthSection carId={carId} />
          <TrendsSection carId={carId} />
          <Suspense fallback={<Skeleton className="h-[420px]" />}>
            <FullMapView carId={carId} range={{ startDate, endDate }} />
          </Suspense>
          <UpdatesSection carId={carId} />
        </>
      )}
    </main>
  );
}

export default function App() {
  return (
    <DateRangeProvider>
      <UnitsProvider>
        <VehicleProvider>
          <div className="min-h-screen bg-background">
            <TopBar />
            <Dashboard />
          </div>
        </VehicleProvider>
      </UnitsProvider>
    </DateRangeProvider>
  );
}
