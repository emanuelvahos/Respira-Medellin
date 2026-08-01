"use client";

import { useEffect, useRef } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";
import { useComunas, usePM25, useResumenComuna } from "@/lib/api/queries";
import { useMapStore } from "@/store/mapStore";
import { cn } from "@/lib/utils";
import { normalizeComunaName } from "@/lib/map/matchComuna";

export function ComunaDetailPanel() {
  const { selectedComuna, setSelectedComuna } = useMapStore();
  const comunasQuery = useComunas();
  const resumenQuery = useResumenComuna();
  const pm25Query = usePM25();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isOpen = selectedComuna !== null;

  // Mueve el foco al botón de cierre al abrir: la selección de comuna puede
  // venir del `<select>` de teclado (ComunaKeyboardSelector) o de un click en
  // el canvas, y en ambos casos el panel debe anunciarse y quedar navegable
  // sin que el usuario tenga que buscarlo con Tab.
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  const feature = comunasQuery.data?.features.find(
    (f) => normalizeComunaName(f.properties.nombre) === selectedComuna,
  );
  const resumen = resumenQuery.data?.find(
    (r) => normalizeComunaName(r.comuna) === selectedComuna,
  );
  const registrosPm25 = pm25Query.data?.filter(
    (r) => normalizeComunaName(r.comuna) === selectedComuna,
  );
  const arbolesActuales = registrosPm25?.length
    ? Math.max(...registrosPm25.map((r) => r.cantidad_arboles_totales))
    : undefined;

  return (
    <aside
      className={cn(
        "absolute inset-y-0 right-0 z-20 w-full max-w-sm border-l border-border bg-card p-5 shadow-xl transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
      aria-hidden={!isOpen}
      role="dialog"
      aria-label={`Detalle de ${feature?.properties.nombre ?? selectedComuna ?? "comuna"}`}
    >
      {isOpen && (
        <div className="flex h-full flex-col">
          <div className="mb-4 flex items-start justify-between gap-2">
            <h2 className="font-heading text-xl font-semibold text-foreground">
              {feature?.properties.nombre ?? selectedComuna}
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setSelectedComuna(null)}
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Cerrar panel de comuna"
            >
              <XIcon size={20} />
            </button>
          </div>

          {resumenQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Cargando datos…</p>
          )}

          {resumenQuery.isSuccess && !resumen && (
            <p className="text-sm text-muted-foreground">
              No hay datos de recomendación de siembra para esta comuna.
            </p>
          )}

          {resumen && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div className="col-span-2 rounded-md bg-vegetation-muted p-3">
                <dt className="text-xs text-muted-foreground">
                  Score AHP (prioridad)
                </dt>
                <dd className="mt-1 font-heading text-2xl font-semibold text-vegetation">
                  {resumen.score_multicriteria.toFixed(2)}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  Ranking #{resumen.ranking_prioridad}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">
                  PM2.5 promedio
                </dt>
                <dd className="font-medium text-foreground">
                  {resumen.pm25_promedio != null
                    ? `${resumen.pm25_promedio.toFixed(1)} µg/m³`
                    : "Sin dato"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">
                  Árboles registrados
                </dt>
                <dd className="font-medium text-foreground">
                  {arbolesActuales ?? "Sin dato"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">
                  Zonas priorizadas
                </dt>
                <dd className="font-medium text-foreground">
                  {resumen.n_zonas_disponibles}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">
                  Área disponible
                </dt>
                <dd className="font-medium text-foreground">
                  {resumen.area_total_disponible_ha.toFixed(1)} ha
                </dd>
              </div>

              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">
                  Especie principal recomendada
                </dt>
                <dd className="font-medium text-foreground">
                  {resumen.especie_principal} ({resumen.cupo_especie_principal}{" "}
                  cupos)
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}
    </aside>
  );
}
