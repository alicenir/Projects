import { useDrives } from "@/api/hooks";
import { Button } from "@/components/ui/Button";
import { ErrorState, EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DateRangeParams } from "@/api/client";
import type { LengthUnit } from "@/lib/units";
import { DriveRow } from "./DriveRow";
import type { DriveFilterValues } from "./DriveFilters";
import { Route } from "lucide-react";

export function DrivesList({
  carId,
  range,
  filters,
  onSelect,
}: {
  carId: number | null;
  range: DateRangeParams;
  filters: DriveFilterValues;
  onSelect: (driveId: number) => void;
}) {
  const { data, isLoading, isError, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useDrives(
    carId,
    range,
    filters
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

  const drives = data?.pages.flatMap((p) => p.data.drives) ?? [];
  const lengthUnit = (data?.pages[0]?.data.units.unit_of_length ?? "km") as LengthUnit;

  if (drives.length === 0) {
    return (
      <EmptyState
        icon={<Route className="h-6 w-6" />}
        title="No drives in this period"
        description="Try widening the date range or clearing your filters."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {drives.map((drive) => (
        <DriveRow key={drive.drive_id} drive={drive} lengthUnit={lengthUnit} onClick={() => onSelect(drive.drive_id)} />
      ))}
      {hasNextPage && (
        <Button variant="outline" size="sm" className="mx-auto mt-2" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
    </div>
  );
}
