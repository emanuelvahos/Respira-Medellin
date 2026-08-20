"use client";

import { useMapStore, type TreeMode } from "@/store/mapStore";

const MODE_LABELS: Record<TreeMode, string> = {
  comuna: "Por comuna",
  ciudad: "Ciudad completa",
};

/**
 * Selector explícito entre las dos formas de ver árboles reales del SAU:
 * - "Por comuna": conos 3D reales, solo al seleccionar una comuna (default).
 * - "Ciudad completa": capa de clusters/puntos de toda Medellín, sabidamente
 *   más lenta al hacer zoom (fuera de alcance optimizarla aquí) — por eso se
 *   muestra una advertencia breve y no bloqueante al activarla.
 *
 * Ambos modos son mutuamente excluyentes (ver `setTreeMode` en el store):
 * mostrarlos a la vez sería el mismo inventario duplicado visualmente.
 */
export function TreeModeSelector() {
  const treeMode = useMapStore((state) => state.treeMode);
  const setTreeMode = useMapStore((state) => state.setTreeMode);

  return (
    // Lado derecho, debajo de `MapLayerToggles` ("Capas"): el borde
    // izquierdo ya está ocupado por `ComunaKeyboardSelector`,
    // `CopyLinkButton` y (en pantallas bajas) el borde superior de
    // `MapLegend` — verificado visualmente que se solapaban ahí.
    <div className="absolute right-4 top-[15.5rem] z-10 w-64 rounded-lg border border-border bg-card/95 p-3 text-sm shadow-md backdrop-blur">
      <p className="mb-2 font-heading text-sm font-semibold text-card-foreground">
        Árboles del SAU (inventario real)
      </p>
      <div
        role="tablist"
        aria-label="Modo de visualización de árboles"
        className="flex gap-1 rounded-md border border-border bg-muted/40 p-0.5"
      >
        {(Object.keys(MODE_LABELS) as TreeMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={treeMode === mode}
            onClick={() => setTreeMode(mode)}
            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              treeMode === mode
                ? "bg-vegetation text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      {treeMode === "ciudad" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Puede ser más lento al hacer zoom en dispositivos menos potentes.
        </p>
      )}
    </div>
  );
}
