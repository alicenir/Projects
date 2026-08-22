import { BatteryCharging } from "lucide-react";
import { useCharges } from "@/api/hooks";
import type { DateRangeParams } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChargeRow } from "./ChargeRow";

export function ChargesList({
  carId,
  range,
  location,
  onSelect,
}: {
  carId: number | null;
  range: DateRangeParams;
  location?: string;
  onSelect: (chargeId: number) => void;
}) {
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useCharges(
    carId,
    range,
    { location }
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={() => refetch()} />;
  }

  const charges = data?.pages.flatMap((p) => p.data.charges) ?? [];

  if (charges.length === 0) {
    return (
      <EmptyState
        icon={<BatteryCharging className="h-6 w-6" />}
        title="No charging sessions in this period"
        description="Try widening the date range."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {charges.map((charge) => (
        <ChargeRow key={charge.charge_id} charge={charge} onClick={() => onSelect(charge.charge_id)} />
      ))}
      {hasNextPage && (
        <Button variant="outline" size="sm" className="mx-auto mt-2" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
