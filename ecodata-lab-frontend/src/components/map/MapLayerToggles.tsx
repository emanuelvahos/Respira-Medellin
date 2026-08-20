"use client";

import { useMemo } from "react";
import { useMapStore, type MapLayerId } from "@/store/mapStore";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useZonasSiembraGeojson } from "@/lib/api/queries";

// `arbolesSau` ya no es un checkbox suelto aquí: se controla desde el
// selector explícito de modo (`TreeModeSelector`), que decide entre "por
// comuna" (árboles 3D) y "ciudad completa" (esta capa de clusters/puntos).
const LAYER_LABELS: Record<Exclude<MapLayerId, "arbolesSau">, string> = {
  comunas: "Comunas (prioridad AHP)",
  zonasSiembra: "Zonas priorizadas de siembra",
  zonasVerdes: "Zonas verdes (inventario)",
  pm25: "PM2.5 (partículas animadas)",
};

export function MapLayerToggles() {
  const {
    layers,
    toggleLayer,
    particlesPaused,
    toggleParticlesPaused,
    mapStyle,
    toggleMapStyle,
    mostrarZonasDescartadas,
    toggleMostrarZonasDescartadas,
  } = useMapStore();
  const reducedMotion = usePrefersReducedMotion();

  // Fase E1: conteo derivado directamente del GeoJSON que ya alimenta el
  // mapa (mismo dato que `zonasSiembraLayer`), no del resumen AHP del
  // backend (`resumen.n_zonas_disponibles` en `ComunaDetailPanel` es una
  // fuente distinta — pipeline original por comuna — y no se toca aquí: no
  // debe depender de qué esté visible en el mapa). Puramente presentacional.
  const zonasSiembraQuery = useZonasSiembraGeojson();
  const { totalZonas, zonasDescartadas } = useMemo(() => {
    const features = zonasSiembraQuery.data?.features ?? [];
    return {
      totalZonas: features.length,
      zonasDescartadas: features.filter(
        (f) => f.properties.viabilidad_auditada === "posible_no_viable",
      ).length,
    };
  }, [zonasSiembraQuery.data]);

  return (
    // `top-24`, no `top-4`: deja espacio arriba para `AddressSearch`, que
    // ocupa el borde superior de la pantalla.
    <div className="absolute right-4 top-24 z-10 w-64 rounded-lg border border-border bg-card/95 p-4 text-sm shadow-md backdrop-blur">
      <p className="mb-2 font-heading text-sm font-semibold text-card-foreground">
        Capas
      </p>

      <label className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-3">
        <span className="text-foreground">Vista satelital</span>
        <input
          type="checkbox"
          checked={mapStyle === "satellite"}
          onChange={toggleMapStyle}
          className="size-4 accent-vegetation"
        />
      </label>

      <ul className="space-y-2">
        {(Object.keys(LAYER_LABELS) as Exclude<MapLayerId, "arbolesSau">[]).map((id) => (
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

            {id === "zonasSiembra" && layers.zonasSiembra && (
              <div className="mt-2 border-l-2 border-border pl-2">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground">
                    Mostrar zonas descartadas (auditoría)
                  </span>
                  <input
                    type="checkbox"
                    checked={mostrarZonasDescartadas}
                    onChange={toggleMostrarZonasDescartadas}
                    className="size-4 accent-critical"
                  />
                </label>
                {totalZonas > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {(totalZonas - zonasDescartadas).toLocaleString("es-CO")} zonas recomendadas
                    {zonasDescartadas > 0 && (
                      <>
                        {" "}
                        ({zonasDescartadas.toLocaleString("es-CO")} adicionales descartadas por
                        auditoría de terreno — activa este toggle para verlas)
                      </>
                    )}
                  </p>
                )}
              </div>
            )}
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
