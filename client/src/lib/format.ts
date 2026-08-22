/**
 * SABnzbd's `speed` field is abbreviated to a bare unit letter ("64.9 M"),
 * which reads as broken in a UI. We format from `kbpersec` instead so the
 * value always carries a real unit.
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "0 MB/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bytesPerSecond;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}

/** Trims SABnzbd's "0:02:24" / "1:02:24:00" time strings to something compact. */
export function formatTimeLeft(timeleft: string): string {
  if (!timeleft) return "—";
  const parts = timeleft.split(":");
  // SABnzbd reports "0:00:00" when nothing is downloading.
  if (parts.every((p) => Number(p) === 0)) return "—";
  if (parts.length === 3) {
    const [h, m, s] = parts;
    if (Number(h) === 0) return `${Number(m)}m ${s}s`;
    return `${Number(h)}h ${m}m`;
  }
  if (parts.length === 4) {
    const [d, h] = parts;
    return `${Number(d)}d ${Number(h)}h`;
  }
  return timeleft;
}
