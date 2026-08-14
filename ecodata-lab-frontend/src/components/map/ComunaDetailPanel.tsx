"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";
import { useComunas, usePM25, useResumenComuna, useSaludResumenComuna } from "@/lib/api/queries";
import { useMapStore } from "@/store/mapStore";
import { cn } from "@/lib/utils";
import { normalizeComunaName } from "@/lib/map/matchComuna";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";

export function ComunaDetailPanel() {
  const { selectedComuna, setSelectedComuna } = useMapStore();
  const comunasQuery = useComunas();
  const resumenQuery = useResumenComuna();
  const pm25Query = usePM25();
  const saludQuery = useSaludResumenComuna();
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
  const saludComuna = saludQuery.data?.comunas.find(
    (c) => normalizeComunaName(c.comuna) === selectedComuna,
  );
  const [mostrarTasa, setMostrarTasa] = useState(false);

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
              Esta comuna no tiene zonas de siembra priorizadas en el modelo
              actual: el pipeline de recomendación (AHP) no calculó un score
              para ella con los datos fuente disponibles.
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

          {feature?.properties.poblacion != null && (
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">
                  Población ({feature.properties.poblacion_anio ?? "—"})
                </dt>
                <dd className="font-medium text-foreground">
                  {feature.properties.poblacion.toLocaleString("es-CO")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Densidad</dt>
                <dd className="font-medium text-foreground">
                  {feature.properties.densidad_hab_km2 != null
                    ? `${Math.round(feature.properties.densidad_hab_km2).toLocaleString("es-CO")} hab/km²`
                    : "—"}
                </dd>
              </div>
            </div>
          )}

          {saludComuna && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Diagnósticos respiratorios (red pública Metrosalud)
                </p>
                {saludComuna.tasa_por_1000_hab != null && (
                  <div className="flex shrink-0 rounded-md border border-border p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setMostrarTasa(false)}
                      aria-pressed={!mostrarTasa}
                      className={cn(
                        "rounded px-2 py-0.5",
                        !mostrarTasa ? "bg-vegetation-muted text-vegetation" : "text-muted-foreground",
                      )}
                    >
                      Conteo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarTasa(true)}
                      aria-pressed={mostrarTasa}
                      className={cn(
                        "rounded px-2 py-0.5",
                        mostrarTasa ? "bg-vegetation-muted text-vegetation" : "text-muted-foreground",
                      )}
                    >
                      Tasa /1.000
                    </button>
                  </div>
                )}
              </div>
              <p className="font-heading text-2xl font-semibold text-foreground">
                {mostrarTasa && saludComuna.tasa_por_1000_hab != null
                  ? `${saludComuna.tasa_por_1000_hab.toFixed(1)} / 1.000 hab.`
                  : saludComuna.total_diagnosticos_respiratorios.toLocaleString("es-CO")}
              </p>
              {saludComuna.top_diagnosticos[0] && (
                <p className="text-xs text-muted-foreground">
                  Más frecuente: {saludComuna.top_diagnosticos[0].nombre} (
                  {saludComuna.top_diagnosticos[0].cantidad.toLocaleString("es-CO")})
                </p>
              )}
              <MethodologyNote>
                {mostrarTasa
                  ? "Tasa por 1.000 habitantes: usa la población total proyectada de la comuna (DANE) como denominador, aunque el numerador son solo pacientes de la red pública Metrosalud (régimen subsidiado) — puede subestimar o sobreestimar la carga real según cuánto varíe la cobertura subsidiada entre comunas."
                  : "Red pública Metrosalud (régimen subsidiado); no representa la morbilidad respiratoria total de la comuna. El conteo absoluto favorece a comunas más pobladas — compara con la tasa por 1.000 hab. para un panorama más equilibrado."}
              </MethodologyNote>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
