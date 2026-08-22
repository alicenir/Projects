import { useState } from "react";
import { Search } from "lucide-react";

export interface DriveFilterValues {
  minDistance?: number;
  maxDistance?: number;
  location?: string;
}

export function DriveFilters({
  value,
  onChange,
}: {
  value: DriveFilterValues;
  onChange: (next: DriveFilterValues) => void;
}) {
  const [location, setLocation] = useState(value.location ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onBlur={() => onChange({ ...value, location: location || undefined })}
          onKeyDown={(e) => e.key === "Enter" && onChange({ ...value, location: location || undefined })}
          placeholder="Start or end location…"
          className="w-48 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-muted"
        />
      </div>
      <input
        type="number"
        min={0}
        value={value.minDistance ?? ""}
        onChange={(e) => onChange({ ...value, minDistance: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="Min dist"
        className="w-24 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted"
      />
      <input
        type="number"
        min={0}
        value={value.maxDistance ?? ""}
        onChange={(e) => onChange({ ...value, maxDistance: e.target.value ? Number(e.target.value) : undefined })}
        placeholder="Max dist"
        className="w-24 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted"
      />
    </div>
  );
}
