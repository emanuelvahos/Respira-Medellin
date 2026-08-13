"use client";

import { useMapStore, type MapLayerId } from "@/store/mapStore";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const LAYER_LABELS: Record<MapLayerId, string> = {
  comunas: "Comunas (prioridad AHP)",
  zonasSiembra: "Zonas priorizadas de siembra",
  zonasVerdes: "Zonas verdes (inventario)",
  pm25: "PM2.5 (partículas animadas)",
  arbolesSau: "Árboles SAU (inventario real)",
};

export function MapLayerToggles() {
  const { layers, toggleLayer, particlesPaused, toggleParticlesPaused } = useMapStore();
  const reducedMotion = usePrefersReducedMotion();

  return (
    // `top-24`, no `top-4`: deja espacio arriba para `AddressSearch`, que
    // ocupa el borde superior de la pantalla.
    <div className="absolute right-4 top-24 z-10 w-64 rounded-lg border border-border bg-card/95 p-4 text-sm shadow-md backdrop-blur">
      <p className="mb-2 font-heading text-sm font-semibold text-card-foreground">
        Capas
      </p>
      <ul className="space-y-2">
        {(Object.keys(LAYER_LABELS) as MapLayerId[]).map((id) => (
          <li key={id}>
            <label className="flex items-center justify-between gap-2">
              <span className="text-foreground">{LAYER_LABELS[id]}</span>
              <input
                type="checkbox"
                checked={layers[id]}
                onChange={() => toggleLayer(id)}
                className="size-4 accent-vegetation"
              />
            </label>
          </li>
        ))}
      </ul>

      {layers.pm25 && (
        <div className="mt-3 border-t border-border pt-3">
          <label className="flex items-center justify-between gap-2">
            <span className="text-foreground">Pausar animación de partículas</span>
            <input
              type="checkbox"
              checked={particlesPaused || reducedMotion}
              disabled={reducedMotion}
              onChange={toggleParticlesPaused}
              className="size-4 accent-vegetation"
            />
          </label>
          {reducedMotion && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Pausado automáticamente (preferencia de movimiento reducido del sistema)
            </p>
          )}
        </div>
      )}
    </div>
  );
}
