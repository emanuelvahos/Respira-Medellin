"use client";

import { useState } from "react";
import { SlidersHorizontalIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { MapLayerToggles } from "@/components/map/MapLayerToggles";
import { MapLegend } from "@/components/map/MapLegend";

type Tab = "capas" | "leyenda";

/**
 * Panel único de configuración del mapa: agrupa "Capas" y "Leyenda" en
 * pestañas dentro de una sola caja colapsable, en vez de dos cajas
 * flotantes independientes (ver "Rediseño de paneles flotantes" en
 * docs/ESTADO_PROYECTO.md — el choque recurrente entre `MapLayerToggles` y
 * los paneles de detalle era por acumular cajas sueltas posicionadas de
 * forma independiente).
 *
 * Colapsado por defecto en cualquier tamaño de pantalla: sin footprint fijo
 * cuando no se usa. Al expandir, altura tope (`max-h`) con scroll interno —
 * esto es lo que garantiza que, sin importar cuánto crezca el contenido de
 * "Capas" (nuevos toggles futuros) o de "Leyenda", el panel nunca invade la
 * esquina inferior izquierda (controles menores) ni cruza al lado derecho
 * (paneles de detalle).
 *
 * Cualquier control nuevo de configuración/capa del mapa debe agregarse
 * como una entrada más dentro de `MapLayerToggles` o `MapLegend`, NO como
 * una caja flotante nueva — ese es justamente el patrón que este rediseño
 * reemplaza.
 */
export function MapConfigPanel() {
  const [abierto, setAbierto] = useState(false);
  const [tab, setTab] = useState<Tab>("capas");

  return (
    <div className="absolute left-4 top-16 z-10 w-[calc(100vw-2rem)] max-w-80 sm:w-80">
      <div className="overflow-hidden rounded-lg border border-border bg-card/95 shadow-md backdrop-blur">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="flex w-full items-center gap-2 p-3 text-left"
        >
          <SlidersHorizontalIcon size={18} className="shrink-0 text-vegetation" aria-hidden="true" />
          <span className="font-heading text-sm font-semibold text-card-foreground">
            Capas y leyenda
          </span>
          <span className="ml-auto text-muted-foreground" aria-hidden="true">
            {abierto ? <XIcon size={16} /> : "+"}
          </span>
        </button>

        {abierto && (
          <div className="max-h-[min(70vh,32rem)] overflow-x-hidden overflow-y-auto border-t border-border">
            <div role="tablist" aria-label="Configuración del mapa" className="flex gap-1 p-2 pb-0">
              {(["capas", "leyenda"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors",
                    tab === t
                      ? "bg-vegetation-muted text-vegetation"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="p-3">{tab === "capas" ? <MapLayerToggles /> : <MapLegend />}</div>
          </div>
        )}
      </div>
    </div>
  );
}
