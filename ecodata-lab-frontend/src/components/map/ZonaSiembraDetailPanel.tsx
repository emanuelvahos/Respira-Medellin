"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";
import { useZonaSiembraDetalle } from "@/lib/api/queries";
import { ZonaDudosaThumbnail } from "@/components/map/ZonaDudosaThumbnail";
import { buildZonaDudosaThumbnailUrl } from "@/lib/map/staticImage";
import { approximateCentroid } from "@/lib/map/geoCentroid";
import { flyTo } from "@/lib/map/flyTo";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMapStore } from "@/store/mapStore";
import { cn } from "@/lib/utils";
import { MapPanelPortal } from "@/components/map/MapPanelPortal";

function formatArea(areaM2: number, areaHa: number): string {
  // Zonas pequeñas (Antejardin, Separador) en m² son más legibles que en
  // hectáreas con muchos decimales; zonas grandes (parques) en ha.
  if (areaM2 < 10000) {
    return `${Math.round(areaM2).toLocaleString("es-CO")} m²`;
  }
  return `${areaHa.toFixed(2)} ha`;
}

/**
 * Panel de detalle de una zona de siembra (Fase E2): área real, especie
 * recomendada, justificación real (rango altitudinal/tipo de suelo de la
 * ficha botánica) y beneficio esperado (individuos recomendados ×
 * eficiencia PM2.5 cualitativa — nunca un número de µg inventado, ver
 * backend/README.md "Detalle de zona de siembra (Fase E2)" para por qué).
 *
 * Comparte la misma región fija de pantalla (columna derecha, slide-in)
 * que `ComunaDetailPanel` — nunca se muestran ambos a la vez, ver la
 * exclusión mutua en `mapStore.ts` (`setSelectedZonaSiembra`/
 * `setSelectedComuna`). Self-contained: lee `selectedZonaSiembra` del store
 * directamente, no recibe props (mismo patrón que `ComunaDetailPanel`).
 */
export function ZonaSiembraDetailPanel() {
  const { selectedZonaSiembra: zona, setSelectedZonaSiembra, setViewState, setMapStyle } =
    useMapStore();
  const reducedMotion = usePrefersReducedMotion();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isOpen = zona !== null;

  useEffect(() => {
    // `preventScroll`: ver comentario equivalente en ComunaDetailPanel.
    if (isOpen) closeButtonRef.current?.focus({ preventScroll: true });
  }, [isOpen]);

  const detalleQuery = useZonaSiembraDetalle(zona?.properties.id_poligono ?? null);
  const detalle = detalleQuery.data;
  const ficha = detalle?.ficha_especie ?? null;
  const dudosa = zona?.properties.viabilidad_auditada === "posible_no_viable";
  const [mostrarDiversificacion, setMostrarDiversificacion] = useState(false);

  const zonaDudosaThumbnailUrl = useMemo(() => {
    if (!dudosa || !zona) return null;
    const centroid = approximateCentroid(zona.geometry);
    return centroid ? buildZonaDudosaThumbnailUrl(centroid[0], centroid[1]) : null;
  }, [dudosa, zona]);

  const porQueTexto = useMemo(() => {
    if (!ficha) return null;
    const [altMin, altMax] = ficha.rango_altitudinal_msnm;
    const suelo = ficha.tipo_suelo.join(", ").toLowerCase();
    return (
      `Se recomienda por su compatibilidad con el rango altitudinal documentado para la especie ` +
      `(${altMin.toLocaleString("es-CO")}-${altMax.toLocaleString("es-CO")} msnm, dentro del cual está ` +
      `Medellín, ~1.495 msnm) y el tipo de suelo predominante (${suelo}). Tasa de crecimiento ` +
      `${ficha.tasa_crecimiento.toLowerCase()}, densidad de follaje ${ficha.densidad_follaje.toLowerCase()}.`
    );
  }, [ficha]);

  return (
    <MapPanelPortal>
    <aside
      className={cn(
        "fixed top-16 bottom-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-border bg-card p-5 text-sm shadow-xl transition-transform duration-300 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
      aria-hidden={!isOpen}
      role="dialog"
      aria-label={`Detalle de zona de siembra${zona ? `: ${zona.properties.nombre_comun_especie}` : ""}`}
    >
      {zona && (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading text-base font-semibold text-card-foreground">
              {zona.properties.nombre_comun_especie}{" "}
              <span className="font-normal text-muted-foreground">
                ({zona.properties.especie_recomendada})
              </span>
            </p>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setSelectedZonaSiembra(null)}
              aria-label="Cerrar panel de zona de siembra"
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon size={20} />
            </button>
          </div>
          <p className="mt-1 text-muted-foreground">{zona.properties.comuna}</p>

          {dudosa && (
            <>
              <div className="mt-3 rounded-md border border-critical/40 bg-critical/10 p-2 text-critical">
                <p className="font-medium">⚠ Verificar en terreno antes de proceder</p>
                <p className="mt-1 text-xs">
                  Esta zona se solapa con{" "}
                  {zona.properties.viabilidad_motivo ?? "una superficie no sembrable"} según el
                  inventario de GeoMedellín — recomendamos verificar en terreno antes de proceder.
                </p>
              </div>

              <div className="mt-3">
                <ZonaDudosaThumbnail
                  src={zonaDudosaThumbnailUrl}
                  alt={`Foto aérea de la zona en ${zona.properties.comuna}`}
                />
              </div>
            </>
          )}

          {detalleQuery.isLoading && (
            <p className="mt-3 text-xs text-muted-foreground">Cargando detalle…</p>
          )}

          {detalleQuery.isError && (
            <p className="mt-3 text-xs text-muted-foreground">
              No se pudo cargar el detalle de esta zona.
            </p>
          )}

          {detalle && (
            <dl className="mt-3 space-y-3 border-t border-border pt-3">
              <div>
                <dt className="text-xs text-muted-foreground">Área</dt>
                <dd className="font-medium text-foreground">
                  {formatArea(detalle.area_m2, detalle.area_ha)} — cupo estimado:{" "}
                  {detalle.arboles_cupo_estimado} árboles
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">Por qué esta especie</dt>
                {ficha ? (
                  <dd className="mt-0.5 text-xs text-foreground">{porQueTexto}</dd>
                ) : (
                  <dd className="mt-0.5 text-xs italic text-muted-foreground">
                    Información detallada no disponible para esta especie en la fuente actual
                    (`{zona.properties.especie_recomendada}` no tiene ficha en
                    fichas_especies.json).
                  </dd>
                )}
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">Beneficio esperado</dt>
                <dd className="mt-0.5 text-xs text-foreground">
                  {detalle.arboles_cupo_estimado} individuos recomendados con eficiencia de
                  mitigación de PM2.5 <strong>{detalle.eficiencia_pm25.toLowerCase()}</strong> (calificación
                  cualitativa por densidad de follaje — no existe un valor real cuantificado en
                  µg/individuo en las fuentes del proyecto, ver backend/README.md).
                  {ficha && ficha.funcion.length > 0 && (
                    <>
                      {" "}
                      Función documentada: {ficha.funcion.join(", ").toLowerCase()}.
                    </>
                  )}
                </dd>
              </div>

              {ficha && (
                <div>
                  <dt className="text-xs text-muted-foreground">Ficha botánica</dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">
                    {ficha.familia} · origen {ficha.origen.toLowerCase()} · longevidad{" "}
                    {ficha.longevidad.toLowerCase()} · {ficha.estado_conservacion}
                  </dd>
                </div>
              )}

              <div className="border-t border-border pt-3">
                {detalle.diversificacion_disponible && detalle.propuesta_diversificacion ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMostrarDiversificacion((v) => !v)}
                      aria-expanded={mostrarDiversificacion}
                      className="flex w-full items-center justify-between text-xs font-medium text-vegetation hover:underline"
                    >
                      <span>Ver propuesta de diversificación</span>
                      <span aria-hidden="true">{mostrarDiversificacion ? "−" : "+"}</span>
                    </button>

                    {mostrarDiversificacion && (
                      <div className="mt-2 rounded-md border border-vegetation/40 bg-vegetation-muted p-2">
                        <p className="text-[11px] font-medium text-vegetation">
                          Propuesta exploratoria de este proyecto, no la recomendación oficial del
                          modelo original
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Reparto equitativo del cupo entre las especies documentadas compatibles con
                          esta categoría de zona (misma altitud y criterio de categoría que usa el
                          modelo original) — ver backend/README.md.
                        </p>
                        <ul className="mt-2 space-y-1 text-xs text-foreground">
                          {detalle.propuesta_diversificacion.map((e) => (
                            <li key={e.especie} className="flex items-center justify-between gap-2">
                              <span>{e.especie}</span>
                              <span className="text-muted-foreground">
                                {e.individuos_estimado} ({Math.round(e.proporcion * 100)}%)
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {detalle.n_especies_compatibles != null && detalle.n_especies_compatibles < 2
                      ? "Solo una especie documentada es compatible con esta zona — sin margen para proponer diversificación con los datos actuales."
                      : "Esta zona tiene varias especies compatibles, pero su cupo de árboles es demasiado bajo para repartirlo entre especies de forma práctica."}
                  </p>
                )}
              </div>
            </dl>
          )}

          <button
            type="button"
            onClick={() => {
              const centroid = approximateCentroid(zona.geometry);
              if (centroid) {
                flyTo(
                  setViewState,
                  { longitude: centroid[0], latitude: centroid[1], zoom: 18.5, pitch: 0, bearing: 0 },
                  reducedMotion,
                );
              }
              setMapStyle("satellite");
            }}
            className="mt-3 w-full rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
          >
            Ver en el mapa completo
          </button>
        </>
      )}
    </aside>
    </MapPanelPortal>
  );
}
