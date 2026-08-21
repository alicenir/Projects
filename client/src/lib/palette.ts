/**
 * Category accent colours. Flame gets its energy from several saturated
 * fields on screen at once; we get the same effect by tinting each category
 * rather than colour-blocking the whole canvas.
 */
export const CATEGORY_COLORS = [
  "#f5c518", // amber
  "#7c5cff", // violet
  "#22d3ee", // cyan
  "#34d399", // emerald
  "#fb7185", // rose
  "#f97316", // orange
];

export function categoryColor(seed: number | null | undefined): string {
  if (seed === null || seed === undefined) return "var(--accent)";
  return CATEGORY_COLORS[Math.abs(seed) % CATEGORY_COLORS.length];
}

/** "https://sonarr.local:8989/path" -> "sonarr.local:8989" */
export function displayHost(url: string): string {
  try {
    return new URL(url).host || url;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}
