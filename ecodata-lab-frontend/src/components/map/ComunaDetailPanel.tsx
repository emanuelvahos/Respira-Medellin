"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";
import {
  useArbolesComunasDetalle,
  useComunas,
  useEstacionesPM25,
  usePM25,
  useResumenComuna,
  useSaludResumenComuna,
} from "@/lib/api/queries";
import { useMapStore } from "@/store/mapStore";
import { cn } from "@/lib/utils";
import { normalizeComunaName } from "@/lib/map/matchComuna";
import { isPointInPolygon } from "@/lib/map/pointInPolygon";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";
import { MapPanelPortal } from "@/components/map/MapPanelPortal";

export function ComunaDetailPanel() {
  const { selectedComuna, setSelectedComuna } = useMapStore();
  const comunasQuery = useComunas();
  const resumenQuery = useResumenComuna();
  const pm25Query = usePM25();
  const saludQuery = useSaludResumenComuna();
  const detalleQuery = useArbolesComunasDetalle();
  const estacionesQuery = useEstacionesPM25();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const isOpen = selectedComuna !== null;

  // Mueve el foco al botón de cierre al abrir: la selección de comuna puede
  // venir del `<select>` de teclado (ComunaKeyboardSelector) o de un click en
  // el canvas, y en ambos casos el panel debe anunciarse y quedar navegable
  // sin que el usuario tenga que buscarlo con Tab.
  useEffect(() => {
    // `preventScroll`: sin esto, enfocar el botón (fuera del viewport visible
    // en el momento del render, ya que el panel recién empieza su transición
    // de entrada) dispara el scroll-into-view por defecto del navegador
    // sobre la PÁGINA completa (no solo el panel) — revelando el footer
    // global y empujando el resto del layout del mapa fuera de la vista.
    if (isOpen) closeButtonRef.current?.focus({ preventScroll: true });
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
  const detalle = detalleQuery.data?.find(
    (d) => normalizeComunaName(d.comuna) === selectedComuna,
  );
  const arbolesActuales = detalle
    ? detalle.arboles_vivos.toLocaleString("es-CO")
    : registrosPm25?.length
      ? Math.max(...registrosPm25.map((r) => r.cantidad_arboles_totales))
      : undefined;
  const saludComuna = saludQuery.data?.comunas.find(
    (c) => normalizeComunaName(c.comuna) === selectedComuna,
  );
  const [mostrarTasa, setMostrarTasa] = useState(false);

  // Cobertura real de medición (Fase F2): cuántas estaciones SIATA caen
  // físicamente dentro del polígono de esta comuna — mismo point-in-polygon
  // (ray casting) ya usado para dispersar árboles/zonas dentro de un
  // polígono real (`randomPointsInPolygon`), aquí solo para contar. Esto es
  // lo que explica visualmente, en el mapa, por qué una comuna tiene PM2.5
  // "estimado" o "histórico": no tiene ninguna estación propia.
  const nEstaciones = useMemo(() => {
    if (!feature || !estacionesQuery.data) return null;
    return estacionesQuery.data.filter((e) =>
      isPointInPolygon([e.lon, e.lat], feature.geometry),
    ).length;
  }, [feature, estacionesQuery.data]);

  return (
    <MapPanelPortal>
    <aside
      className={cn(
        "fixed top-16 bottom-0 right-0 z-20 w-full max-w-sm panel-scroll overflow-y-auto border-l border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl transition-transform duration-300 ease-out",
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
              className="inline-flex items-center justify-center rounded-sm p-1 pointer-coarse:size-11 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          {resumen?.pm25_tipo_dato === "interpolado" && (
            <div
              role="note"
              className="mb-4 rounded-md border-2 border-dotted border-critical bg-critical/10 p-3 text-sm text-foreground"
            >
              <p className="font-medium text-critical">
                ⚠ PM2.5 estimado, no medido directamente
              </p>
              <p className="mt-1 text-xs">
                PM2.5 estimado por interpolación espacial (IDW), no medido
                directamente — confianza{" "}
                <strong>{resumen.pm25_confianza ?? "media"}</strong>. Estación
                real más cercana a{" "}
                <strong>
                  {resumen.pm25_distancia_estacion_mas_cercana_km != null
                    ? `${resumen.pm25_distancia_estacion_mas_cercana_km.toFixed(1)} km`
                    : "distancia desconocida"}
                </strong>
                . Este es el dato menos confiable del sistema: el score AHP de
                esta comuna hereda esa incertidumbre.
              </p>
            </div>
          )}

          {resumen?.pm25_tipo_dato === "historico" && (
            <div
              role="note"
              className="mb-4 rounded-md border-2 border-solid border-data-sky bg-data-sky/10 p-3 text-sm text-foreground"
            >
              <p className="font-medium text-data-sky">
                ⏱ PM2.5 basado en datos históricos reales
              </p>
              <p className="mt-1 text-xs">
                PM2.5 basado en datos históricos reales (estación MED-ALTA2,
                activa hasta{" "}
                <strong>{resumen.pm25_fecha_ultimo_dato ?? "fecha desconocida"}</strong>) —
                sin monitoreo vigente actualmente en esta zona. Es una
                medición directa, pero no representa necesariamente las
                condiciones actuales.
              </p>
            </div>
          )}

          {resumen && !resumen.tiene_zona_siembra && (
            <div
              role="note"
              className="mb-4 rounded-md border border-warning bg-warning/10 p-3 text-sm text-foreground"
            >
              <p className="font-medium">Sin zona de siembra identificada</p>
              <p className="mt-1 text-xs">
                Esta comuna tiene un score AHP de prioridad calculado (dato
                PM2.5 disponible o estimado), pero no se identificaron zonas
                de siembra viables en el inventario real de zonas verdes.
                Prioridad conocida, sin sitio de siembra concreto.
              </p>
            </div>
          )}

          {detalle && (
            <section aria-label="Por qué esta prioridad" className="mb-4 rounded-md border bg-muted/40 p-3 text-xs">
              <h3 className="font-heading text-sm font-semibold text-foreground">Por qué esta prioridad</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-foreground">
                {detalle.razones.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <p className="mt-2 text-muted-foreground">
                {detalle.arboles_por_1000_hab != null &&
                  `${detalle.arboles_por_1000_hab.toLocaleString("es-CO")} árboles por 1.000 hab. · `}
                {detalle.talados.toLocaleString("es-CO")} talados registrados · especie principal:{" "}
                {detalle.top_especies[0]?.nombre_comun ?? detalle.top_especies[0]?.especie ?? "sin dato"}
              </p>
            </section>
          )}

          {resumen && (
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div
                className={cn(
                  "col-span-2 rounded-md p-3",
                  resumen.tiene_zona_siembra ? "bg-vegetation-muted" : "border-2 border-dashed border-warning bg-muted",
                )}
              >
                <dt className="text-xs text-muted-foreground">
                  Score AHP (prioridad)
                  {!resumen.tiene_zona_siembra && " · sin zona de siembra"}
                </dt>
                <dd
                  className={cn(
                    "mt-1 font-heading text-2xl font-semibold",
                    resumen.tiene_zona_siembra ? "text-vegetation" : "text-warning",
                  )}
                >
                  {resumen.score_multicriteria.toFixed(2)}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  Ranking #{resumen.ranking_prioridad}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">
                  PM2.5 promedio
                  {resumen.pm25_tipo_dato === "interpolado" && " (estimado)"}
                  {resumen.pm25_tipo_dato === "historico" && " (histórico, no vigente)"}
                </dt>
                <dd
                  className={cn(
                    "font-medium",
                    resumen.pm25_tipo_dato === "interpolado" && "text-critical",
                    resumen.pm25_tipo_dato === "historico" && "text-data-sky",
                    resumen.pm25_tipo_dato !== "interpolado" &&
                      resumen.pm25_tipo_dato !== "historico" &&
                      "text-foreground",
                  )}
                >
                  {resumen.pm25_promedio != null
                    ? `${resumen.pm25_promedio.toFixed(1)} µg/m³${
                        resumen.pm25_tipo_dato === "interpolado" ? " ⚠" : ""
                      }${resumen.pm25_tipo_dato === "historico" ? " ⏱" : ""}`
                    : "Sin dato"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">
                  Estaciones de monitoreo PM2.5
                </dt>
                <dd
                  className={cn(
                    "font-medium",
                    nEstaciones != null && nEstaciones <= 1 ? "text-warning" : "text-foreground",
                  )}
                >
                  {nEstaciones ?? "Cargando…"}
                </dd>
              </div>

              <div>
                <dt className="text-xs text-muted-foreground">
                  Árboles vivos (SAU)
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
                <dd
                  className={cn(
                    "font-medium",
                    resumen.tiene_zona_siembra ? "text-foreground" : "italic text-muted-foreground",
                  )}
                >
                  {resumen.tiene_zona_siembra
                    ? `${resumen.especie_principal} (${resumen.cupo_especie_principal} cupos)`
                    : "No se identificaron zonas de siembra viables en esta comuna con los datos disponibles."}
                </dd>
              </div>
            </dl>
          )}

          {nEstaciones != null && nEstaciones <= 1 && (
            <div className="mt-3">
              <MethodologyNote>
                {nEstaciones === 0
                  ? "Esta comuna no tiene ninguna estación de monitoreo propia — su PM2.5 no se mide directamente aquí (ver arriba si es estimado por interpolación o histórico de una comuna vecina)."
                  : "Esta comuna tiene 1 estación de monitoreo — el dato de PM2.5 puede ser menos representativo de toda su área que en comunas con más cobertura."}
              </MethodologyNote>
            </div>
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
    </MapPanelPortal>
  );
}
