import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import App from "./App";
import "./index.css";
// Loaded eagerly (not from within the lazy-loaded map components) so it's
// always present before any MapLibre instance initializes — MapLibre's
// canvas is `position: absolute` and relies on this stylesheet's
// `.maplibregl-map { position: relative }` to stay contained; without it,
// the canvas positions itself against the viewport instead of its card.
import "maplibre-gl/dist/maplibre-gl.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
