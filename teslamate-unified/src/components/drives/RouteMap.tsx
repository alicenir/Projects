import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { DriveDetailPoint } from "@/api/schemas";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function toSegments(points: DriveDetailPoint[]): GeoJSON.FeatureCollection<GeoJSON.LineString, { speed: number }> {
  const features: GeoJSON.Feature<GeoJSON.LineString, { speed: number }>[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    features.push({
      type: "Feature",
      properties: { speed: (a.speed + b.speed) / 2 },
      geometry: {
        type: "LineString",
        coordinates: [
          [a.longitude, a.latitude],
          [b.longitude, b.latitude],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function RouteMap({ points }: { points: DriveDetailPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return;

    const bounds = points.reduce(
      (b, p) => b.extend([p.longitude, p.latitude]),
      new maplibregl.LngLatBounds([points[0].longitude, points[0].latitude], [points[0].longitude, points[0].latitude])
    );

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      bounds,
      fitBoundsOptions: { padding: 32 },
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    mapRef.current = map;

    const maxSpeed = Math.max(1, ...points.map((p) => p.speed));

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: toSegments(points) });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-width": 4,
          "line-color": [
            "interpolate",
            ["linear"],
            ["get", "speed"],
            0,
            "#38bdf8",
            maxSpeed * 0.5,
            "#facc15",
            maxSpeed,
            "#f43f5e",
          ],
        },
      });

      new maplibregl.Marker({ color: "#22c55e" })
        .setLngLat([points[0].longitude, points[0].latitude])
        .addTo(map);
      new maplibregl.Marker({ color: "#ef4444" })
        .setLngLat([points[points.length - 1].longitude, points[points.length - 1].latitude])
        .addTo(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  if (points.length < 2) {
    return (
      <div className="flex h-full min-h-[220px] items-center justify-center rounded-xl bg-surface-raised text-xs text-ink-muted">
        No route data for this drive
      </div>
    );
  }

  return <div ref={containerRef} className="relative h-full min-h-[220px] w-full overflow-hidden rounded-xl" />;
}
