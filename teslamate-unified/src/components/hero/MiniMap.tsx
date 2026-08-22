import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

// OpenFreeMap — free, keyless vector tiles. No Google Maps, no API key.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export function MiniMap({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || latitude === null || longitude === null) return;

    if (!mapRef.current) {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [longitude, latitude],
        zoom: 14,
        interactive: true,
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({ compact: true }));
      mapRef.current = map;

      const el = document.createElement("div");
      el.className = "h-3.5 w-3.5 rounded-full border-2 border-white bg-drive shadow-[0_0_0_4px_rgba(56,189,248,0.35)]";
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
    } else {
      mapRef.current.setCenter([longitude, latitude]);
      markerRef.current?.setLngLat([longitude, latitude]);
    }

    return () => {
      // Only torn down when the component itself unmounts (see cleanup effect below).
    };
  }, [latitude, longitude]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  if (latitude === null || longitude === null) {
    return (
      <div className="flex h-full min-h-[140px] items-center justify-center rounded-xl bg-surface-raised text-xs text-ink-muted">
        No location data yet
      </div>
    );
  }

  return <div ref={containerRef} className="relative h-full min-h-[140px] w-full overflow-hidden rounded-xl" />;
}
