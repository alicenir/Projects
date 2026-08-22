export type LengthUnit = "km" | "mi";
export type TempUnit = "C" | "F";
export type UnitSystem = "metric" | "imperial";

export function systemFromLengthUnit(unit: string): UnitSystem {
  return unit === "mi" ? "imperial" : "metric";
}

const KM_TO_MI = 0.621371;

/** value is already expressed in `sourceUnit` (whatever TeslaMateAPI reported); convert to the target display system if they differ. */
export function displayDistance(value: number, sourceUnit: LengthUnit, target: UnitSystem): number {
  const targetUnit: LengthUnit = target === "imperial" ? "mi" : "km";
  if (sourceUnit === targetUnit) return value;
  return targetUnit === "mi" ? value * KM_TO_MI : value / KM_TO_MI;
}

export function displayTemp(value: number, sourceUnit: TempUnit, target: UnitSystem): number {
  const targetUnit: TempUnit = target === "imperial" ? "F" : "C";
  if (sourceUnit === targetUnit) return value;
  return targetUnit === "F" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
}

export function formatDistance(value: number, sourceUnit: LengthUnit, target: UnitSystem, digits = 0): string {
  const converted = displayDistance(value, sourceUnit, target);
  return `${converted.toFixed(digits)} ${target === "imperial" ? "mi" : "km"}`;
}

export function formatTemp(value: number, sourceUnit: TempUnit, target: UnitSystem): string {
  const converted = displayTemp(value, sourceUnit, target);
  return `${Math.round(converted)}°${target === "imperial" ? "F" : "C"}`;
}

export function formatSpeed(value: number, sourceUnit: LengthUnit, target: UnitSystem): string {
  const converted = displayDistance(value, sourceUnit, target);
  return `${Math.round(converted)} ${target === "imperial" ? "mph" : "km/h"}`;
}
