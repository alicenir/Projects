import { useEffect, useMemo, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { api } from "@/api/client";
import type { DateRangeParams } from "@/api/client";
import { useChargesForRange, useDrivesForRange } from "@/api/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
// Fetching a full route per drive is a per-drive detail call — capped hard
// so a busy month doesn't turn into dozens of parallel requests.
const MAX_ROUTES = 15;

export function FullMapView({ carId, range }: { carId: number; range: DateRangeParams }) {
  const [mode, setMode] = useState<"routes" | "heatmap">("routes");
  const drivesQ = useDrivesForRange(carId, range);
  const chargesQ = useChargesForRange(carId, range);

  const recentDriveIds = useMemo(
    () =>
      [...(drivesQ.data?.drives ?? [])]
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
        .slice(0, MAX_ROUTES)
        .map((d) => d.drive_id),
    [drivesQ.data]
  );

  const routeQueries = useQueries({
    queries: recentDriveIds.map((driveId) => ({
      queryKey: ["drive", carId, driveId],
      queryFn: () => api.driveDetail(carId, driveId),
      staleTime: 60_000,
    })),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setMapReady(true));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Build sources/layers once the style has loaded and route/charge data is in.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const charges = chargesQ.data ?? [];
    const routes = routeQueries.map((q) => q.data).filter((d): d is NonNullable<typeof d> => Boolean(d));
    if (routes.length === 0 && charges.length === 0) return;

    const routeFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = routes
      .filter((r) => r.data.drive.drive_details.length > 1)
      .map((r) => ({
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: r.data.drive.drive_details.map((p) => [p.longitude, p.latitude]),
        },
      }));

    const heatPoints: GeoJSON.Feature<GeoJSON.Point>[] = [
      ...routes.flatMap((r) => r.data.drive.drive_details.map((p) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [p.longitude, p.latitude] } }))),
      ...charges.map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: [c.longitude, c.latitude] } })),
    ];

    const chargeFeatures: GeoJSON.Feature<GeoJSON.Point>[] = charges.map((c) => ({
      type: "Feature",
      properties: { energy: c.charge_energy_added },
      geometry: { type: "Point", coordinates: [c.longitude, c.latitude] },
    }));

    if (!map.getSource("routes")) {
      map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: routeFeatures } });
      map.addLayer({
        id: "routes-layer",
        type: "line",
        source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-width": 2.5, "line-color": "rgb(56,189,248)", "line-opacity": 0.75 },
      });
    } else {
      (map.getSource("routes") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: routeFeatures });
    }

    if (!map.getSource("heat")) {
      map.addSource("heat", { type: "geojson", data: { type: "FeatureCollection", features: heatPoints } });
      map.addLayer({
        id: "heat-layer",
        type: "heatmap",
        source: "heat",
        layout: { visibility: "none" },
        paint: {
          "heatmap-weight": 0.6,
          "heatmap-intensity": 1,
          "heatmap-radius": 18,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0,0,0,0)",
            0.3,
            "#38bdf8",
            0.6,
            "#facc15",
            1,
            "#f43f5e",
          ],
        },
      });
    } else {
      (map.getSource("heat") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: heatPoints });
    }

    if (!map.getSource("charges")) {
      map.addSource("charges", {
        type: "geojson",
        data: { type: "FeatureCollection", features: chargeFeatures },
        cluster: true,
        clusterRadius: 40,
      });
      map.addLayer({
        id: "charge-clusters",
        type: "circle",
        source: "charges",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgb(45,212,145)",
          "circle-radius": ["step", ["get", "point_count"], 14, 5, 18, 15, 24],
          "circle-opacity": 0.85,
        },
      });
      map.addLayer({
        id: "charge-cluster-count",
        type: "symbol",
        source: "charges",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
        paint: { "text-color": "#0b0d10" },
      });
      map.addLayer({
        id: "charge-points",
        type: "circle",
        source: "charges",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-color": "rgb(45,212,145)", "circle-radius": 6, "circle-stroke-width": 2, "circle-stroke-color": "#fff" },
      });
    } else {
      (map.getSource("charges") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: chargeFeatures });
    }

    const allCoords = [...routeFeatures.flatMap((f) => f.geometry.coordinates), ...chargeFeatures.map((f) => f.geometry.coordinates)] as [
      number,
      number,
    ][];
    if (allCoords.length > 0) {
      const bounds = allCoords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));
      map.fitBounds(bounds, { padding: 48, maxZoom: 13 });
    }
  }, [mapReady, chargesQ.data, routeQueries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const routesVisible = mode === "routes" ? "visible" : "none";
    const heatVisible = mode === "heatmap" ? "visible" : "none";
    for (const id of ["routes-layer"]) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", routesVisible);
    if (map.getLayer("heat-layer")) map.setLayoutProperty("heat-layer", "visibility", heatVisible);
  }, [mode, mapReady]);

  const isLoading = drivesQ.isLoading || chargesQ.isLoading || routeQueries.some((q) => q.isLoading);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Map</CardTitle>
        <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5 text-xs font-medium">
          <button
            onClick={() => setMode("routes")}
            className={cn("rounded-full px-2.5 py-1", mode === "routes" ? "bg-drive-soft text-drive" : "text-ink-muted hover:text-ink")}
          >
            Routes
          </button>
          <button
            onClick={() => setMode("heatmap")}
            className={cn("rounded-full px-2.5 py-1", mode === "heatmap" ? "bg-drive-soft text-drive" : "text-ink-muted hover:text-ink")}
          >
            Heatmap
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-[420px]" />}
        <div ref={containerRef} className={cn("h-[420px] w-full overflow-hidden rounded-xl", isLoading && "hidden")} />
        {recentDriveIds.length === MAX_ROUTES && (
          <p className="mt-2 text-[11px] text-ink-muted">
            Showing routes for the {MAX_ROUTES} most recent drives in range (capped to limit detail requests).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
