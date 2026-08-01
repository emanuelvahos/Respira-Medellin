"use client";

import dynamic from "next/dynamic";
import { MapLegend } from "@/components/map/MapLegend";
import { MapLayerToggles } from "@/components/map/MapLayerToggles";
import { ComunaDetailPanel } from "@/components/map/ComunaDetailPanel";
import { ComunaKeyboardSelector } from "@/components/map/ComunaKeyboardSelector";

// El mapa depende de WebGL/`window` (Mapbox GL + deck.gl): no puede
// renderizarse en el servidor.
const MapCanvas = dynamic(
  () => import("@/components/map/MapCanvas").then((mod) => mod.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-border bg-muted">
        <p className="text-sm text-muted-foreground">Cargando mapa…</p>
      </div>
    ),
  },
);

export function MapaClient() {
  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden">
      <MapCanvas />
      <MapLegend />
      <ComunaKeyboardSelector />
      <MapLayerToggles />
      <ComunaDetailPanel />
    </div>
  );
}
