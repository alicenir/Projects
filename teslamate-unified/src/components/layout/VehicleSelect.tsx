import { useVehicle } from "@/context/VehicleContext";

export function VehicleSelect() {
  const { car, cars, carId, setCarId } = useVehicle();

  if (cars.length <= 1) {
    return <span className="text-sm font-semibold text-ink">{car?.name || car?.car_details.vin || "Tesla"}</span>;
  }

  return (
    <select
      value={carId ?? ""}
      onChange={(e) => setCarId(Number(e.target.value))}
      className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm font-medium text-ink"
    >
      {cars.map((c) => (
        <option key={c.car_id} value={c.car_id}>
          {c.name || c.car_details.vin}
        </option>
      ))}
    </select>
  );
}
