"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import type { PickingInfo } from "@deck.gl/core";
import MapGL, { Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { BroadcastIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import {
  useComunas,
  useResumenComuna,
  useZonasSiembraGeojson,
  useZonasVerdes,
  useEstacionesPM25,
  useArbolesClusters,
  useArbolesPuntos,
} from "@/lib/api/queries";
import {
  ARBOLES_SAU_PUNTOS_MIN_ZOOM,
  COMUNA_FLYTO_BEARING,
  COMUNA_FLYTO_PITCH,
  COMUNA_FLYTO_ZOOM,
  MAP_STYLE_URLS,
  MEDELLIN_MAX_BOUNDS,
  MEDELLIN_MAX_ZOOM,
  MEDELLIN_MIN_ZOOM,
  useMapStore,
} from "@/store/mapStore";
import type { Bbox } from "@/lib/api/endpoints";
import { createComunasLayer } from "@/components/map/layers/comunasLayer";
import { createZonasSiembraLayer, type ZonaSiembraFeature } from "@/components/map/layers/zonasSiembraLayer";
import { createZonasVerdesLayer } from "@/components/map/layers/zonasVerdesLayer";
import { createArbolesClustersLayer, createArbolesPuntosLayer } from "@/components/map/layers/arbolesSauLayer";
import {
  buildPm25ParticleField,
  createPm25ParticlesLayer,
  evaluatePm25Particles,
} from "@/components/map/layers/pm25Layer";
import type { ResumenRecomendacionComuna } from "@/types/siembra";
import { normalizeComunaName } from "@/lib/map/matchComuna";
import { approximateCentroid } from "@/lib/map/geoCentroid";
import { flyTo } from "@/lib/map/flyTo";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function MapCanvas() {
  const {
    viewState,
    setViewState,
    layers,
    selectedComuna,
    hoveredComuna,
    setSelectedComuna,
    setHoveredComuna,
    particlesPaused,
    isFlyingTo,
    setIsFlyingTo,
    searchMarker,
    mapStyle,
    mostrarZonasDescartadas,
    setSelectedZonaSiembra,
  } = useMapStore();

  const reducedMotion = usePrefersReducedMotion();
  const mapRef = useRef<MapRef>(null);

  // Memoizado: DeckGL trata un cambio de identidad de `viewState` como un
  // movimiento de cámara real y lo reaplica sobre Mapbox (`Mapbox.setProps`
  // -> `map._render` -> evento "move"). Sin memo, cada re-render reconstruye
  // este objeto por referencia y reinyecta el mismo movimiento, que vuelve a
  // disparar "move" -> re-render: riesgo de bucle si algo más abajo depende
  // de ese evento de movimiento.
  const deckViewState = useMemo(
    () =>
      ({
        ...viewState,
        minZoom: MEDELLIN_MIN_ZOOM,
        maxZoom: MEDELLIN_MAX_ZOOM,
        maxBounds: MEDELLIN_MAX_BOUNDS,
      }) as typeof viewState,
    [viewState],
  );

  const comunasQuery = useComunas();
  const resumenQuery = useResumenComuna();
  const zonasSiembraQuery = useZonasSiembraGeojson();
  const zonasVerdesQuery = useZonasVerdes(layers.zonasVerdes);
  const estacionesPm25Query = useEstacionesPM25();

  // --- Árboles SAU: clusters (grid liviano) a zoom alejado, puntos reales
  // acotados al bbox del viewport solo a partir de ARBOLES_SAU_PUNTOS_MIN_ZOOM.
  const arbolesSauZoomCercano = viewState.zoom >= ARBOLES_SAU_PUNTOS_MIN_ZOOM;
  const [arbolesBbox, setArbolesBbox] = useState<Bbox | null>(null);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    // Si la capa se apaga o se aleja el zoom no se limpia `arbolesBbox`: el
    // query de puntos ya queda `enabled: false` (ver useArbolesPuntos), así
    // que el bbox obsoleto no dispara ningún fetch de más.
    if (!map || !layers.arbolesSau || !arbolesSauZoomCercano) return;
    const updateBbox = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      setArbolesBbox({
        minLon: bounds.getWest(),
        minLat: bounds.getSouth(),
        maxLon: bounds.getEast(),
        maxLat: bounds.getNorth(),
      });
    };
    updateBbox();
    map.on("moveend", updateBbox);
    return () => {
      map.off("moveend", updateBbox);
    };
  }, [layers.arbolesSau, arbolesSauZoomCercano]);

  const arbolesClustersQuery = useArbolesClusters(layers.arbolesSau && !arbolesSauZoomCercano);
  const arbolesPuntosQuery = useArbolesPuntos(
    layers.arbolesSau && arbolesSauZoomCercano,
    arbolesBbox,
  );

  const resumenPorComuna = useMemo(() => {
    const map = new Map<string, ResumenRecomendacionComuna>();
    for (const resumen of resumenQuery.data ?? []) {
      map.set(normalizeComunaName(resumen.comuna), resumen);
    }
    return map;
  }, [resumenQuery.data]);

  const comunasLayer = useMemo(
    () =>
      layers.comunas
        ? createComunasLayer({
            comunas: comunasQuery.data,
            resumenPorComuna,
            selectedComuna,
            hoveredComuna,
            onClick: setSelectedComuna,
            onHover: setHoveredComuna,
          })
        : null,
    [layers.comunas, comunasQuery.data, resumenPorComuna, selectedComuna, hoveredComuna, setSelectedComuna, setHoveredComuna],
  );

  // Panel de la zona de siembra seleccionada (Fase D: auditoría de
  // viabilidad) — click para fijar. Vive en el store (no como estado local)
  // para poder aplicar exclusión mutua real con `selectedComuna`: ambos
  // paneles de detalle comparten la misma región fija de la derecha, ver
  // `setSelectedZonaSiembra`/`setSelectedComuna` en `mapStore.ts`.
  const zonasSiembraLayer = useMemo(
    () =>
      layers.zonasSiembra
        ? createZonasSiembraLayer({
            data: zonasSiembraQuery.data,
            mostrarDescartadas: mostrarZonasDescartadas,
            onClick: setSelectedZonaSiembra,
          })
        : null,
    [layers.zonasSiembra, zonasSiembraQuery.data, mostrarZonasDescartadas, setSelectedZonaSiembra],
  );

  const zonasVerdesLayer = useMemo(
    () =>
      layers.zonasVerdes
        ? createZonasVerdesLayer({ data: zonasVerdesQuery.data })
        : null,
    [layers.zonasVerdes, zonasVerdesQuery.data],
  );

  // --- Partículas PM2.5: campo determinista función de `t`, animado por rAF ---
  const particleField = useMemo(
    () => buildPm25ParticleField(estacionesPm25Query.data ?? []),
    [estacionesPm25Query.data],
  );

  const particlesActive = layers.pm25 && !particlesPaused && !reducedMotion;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!particlesActive) return;
    let raf = 0;
    const loop = (now: number) => {
      if (lastFrameRef.current != null) {
        setElapsedSeconds((prev) => prev + (now - lastFrameRef.current!) / 1000);
      }
      lastFrameRef.current = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lastFrameRef.current = null;
    };
  }, [particlesActive]);

  const particles = useMemo(
    () => evaluatePm25Particles(particleField, elapsedSeconds),
    [particleField, elapsedSeconds],
  );

  const pm25Layer = useMemo(
    () => (layers.pm25 ? createPm25ParticlesLayer({ particles, field: particleField }) : null),
    [layers.pm25, particles, particleField],
  );

  const arbolesClustersLayer = useMemo(
    () =>
      layers.arbolesSau && !arbolesSauZoomCercano
        ? createArbolesClustersLayer({ data: arbolesClustersQuery.data })
        : null,
    [layers.arbolesSau, arbolesSauZoomCercano, arbolesClustersQuery.data],
  );

  const arbolesPuntosLayer = useMemo(
    () =>
      layers.arbolesSau && arbolesSauZoomCercano
        ? createArbolesPuntosLayer({ data: arbolesPuntosQuery.data?.puntos })
        : null,
    [layers.arbolesSau, arbolesSauZoomCercano, arbolesPuntosQuery.data],
  );

  const deckLayers = useMemo(
    () =>
      [
        zonasVerdesLayer,
        pm25Layer,
        // `zonasSiembraLayer` DESPUÉS de `comunasLayer`: deck.gl resuelve
        // picking por orden del array (el último gana), no solo por
        // profundidad real. Con `comunasLayer` al final, un click sobre una
        // zona de siembra dentro de una comuna ya seleccionada (extrusión
        // baja/ausente cerca de la cámara) quedaba sombreado por el polígono
        // plano de la comuna por debajo — el panel de zona nunca se abría.
        // Verificado en navegador (Fase D.1): con este orden, el click
        // selecciona la zona de siembra cuando cae sobre ella, y sigue
        // seleccionando la comuna en cualquier otro punto de su polígono.
        comunasLayer,
        zonasSiembraLayer,
        arbolesClustersLayer,
        arbolesPuntosLayer,
      ].filter(Boolean),
    [
      zonasVerdesLayer,
      pm25Layer,
      zonasSiembraLayer,
      comunasLayer,
      arbolesClustersLayer,
      arbolesPuntosLayer,
    ],
  );

  // --- flyTo de cámara al seleccionar una comuna ---
  //
  // IMPORTANTE: DeckGL controla el `viewState` del mapa subyacente (lo pasa a
  // MapGL como componente controlado). Llamar a `map.flyTo()` imperativamente
  // sobre la instancia de Mapbox NO funciona aquí: DeckGL reimpone el
  // `viewState` de React en cada render y cancela la animación de Mapbox casi
  // de inmediato. Por eso el vuelo se dispara actualizando el `viewState` del
  // store con un `transitionInterpolator` de deck.gl (`FlyToInterpolator`),
  // que es quien realmente anima la cámara compartida por deck.gl + Mapbox.
  //
  // Fase F3: este efecto originalmente también revelaba árboles 3D
  // (`TreeInstances`) al terminar el vuelo — se removieron por decisión de
  // UX (ver docs/ESTADO_PROYECTO.md), el flyTo en sí se mantiene igual.
  useEffect(() => {
    if (!selectedComuna || !isFlyingTo) return;

    const feature = comunasQuery.data?.features.find(
      (f) => normalizeComunaName(f.properties.nombre) === selectedComuna,
    );
    const centroid = feature ? approximateCentroid(feature.geometry) : null;
    if (!centroid) {
      setIsFlyingTo(false);
      return;
    }

    const duration = flyTo(
      setViewState,
      {
        longitude: centroid[0],
        latitude: centroid[1],
        zoom: COMUNA_FLYTO_ZOOM,
        pitch: COMUNA_FLYTO_PITCH,
        bearing: COMUNA_FLYTO_BEARING,
      },
      reducedMotion,
    );

    const timeout = setTimeout(() => setIsFlyingTo(false), duration + 50);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe re-ejecutarse cuando cambia la comuna seleccionada o arranca el flyTo.
  }, [selectedComuna, isFlyingTo]);

  // --- Estaciones reales de monitoreo PM2.5 (SIATA) — marcadores DOM
  // (`Marker`), no una capa deck.gl: son pocos puntos (~10), y así se
  // reutiliza el mismo patrón ya usado para `searchMarker` (ícono Phosphor
  // + evento de click nativo), en vez de armar un atlas de íconos para
  // `IconLayer`. `BroadcastIcon` (antena) es deliberadamente distinto de
  // los íconos/colores ya usados para árboles y zonas de siembra, para que
  // no se confundan a simple vista (Fase F2).
  const [estacionPopupId, setEstacionPopupId] = useState<string | null>(null);
  const estacionPopup = estacionesPm25Query.data?.find((e) => e.id === estacionPopupId) ?? null;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted p-8 text-center">
        <div>
          <p className="font-heading text-lg font-semibold text-foreground">
            Configura NEXT_PUBLIC_MAPBOX_TOKEN
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            El mapa 3D necesita un token público de Mapbox GL JS. Agrégalo en{" "}
            <code className="rounded bg-secondary px-1 py-0.5">.env.local</code>{" "}
            (ver <code className="rounded bg-secondary px-1 py-0.5">.env.local.example</code>) y reinicia el servidor de desarrollo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border">
      <DeckGL
        viewState={deckViewState}
        onViewStateChange={({ viewState: next }) =>
          setViewState(next as typeof viewState)
        }
        controller
        layers={deckLayers}
        getTooltip={({ object, layer }: PickingInfo) => {
          if (!object) return null;

          if (layer?.id === "arboles-sau-puntos") {
            const arbol = object as {
              s_especie?: string | null;
              nombre_comun?: string | null;
              s_estado_arbol?: string | null;
              comuna?: string | null;
            };
            return {
              html: `<strong>${arbol.s_especie ?? "Especie sin dato"}</strong>${arbol.nombre_comun ? `<br/>${arbol.nombre_comun}` : ""}<br/>Estado: ${arbol.s_estado_arbol ?? "s/d"}<br/>Comuna: ${arbol.comuna ?? "s/d"}`,
              className: "deck-tooltip",
            };
          }

          if (layer?.id === "zonas-siembra") {
            // `object` es el Feature completo (GeoJsonLayer), no sus
            // properties directamente — sin `.properties` aquí todos los
            // campos salían `undefined` en el tooltip (bug encontrado en
            // Fase D.1 al verificar en navegador).
            const zona = (object as ZonaSiembraFeature).properties;
            const dudosa = zona.viabilidad_auditada === "posible_no_viable";
            const avisoViabilidad = dudosa
              ? `<br/><span style="color:var(--critical)">⚠ Posible falso positivo — verificar en terreno</span>`
              : "";
            return {
              html: `<strong>${zona.nombre_comun_especie}</strong> (${zona.especie_recomendada})<br/>Cupo estimado: ${zona.arboles_cupo_estimado} árboles<br/>Comuna: ${zona.comuna}${avisoViabilidad}`,
              className: "deck-tooltip",
            };
          }

          if (layer?.id === "arboles-sau-clusters") {
            const cluster = object as { cantidad?: number };
            return {
              html: `<strong>${cluster.cantidad ?? 0} árboles</strong>`,
              className: "deck-tooltip",
            };
          }

          if (!object.properties) return null;
          const props = object.properties as { comuna?: string; nombre?: string };
          const resumen = props.nombre
            ? resumenPorComuna.get(normalizeComunaName(props.nombre))
            : undefined;
          if (!resumen) return null;
          const avisoSinZona = resumen.tiene_zona_siembra
            ? ""
            : `<br/><span style="color:var(--warning)">Sin zona de siembra identificada</span>`;
          const avisoHistorico =
            resumen.pm25_tipo_dato === "historico"
              ? `<br/><span style="color:var(--data-sky)">⏱ PM2.5 histórico, no vigente${resumen.pm25_fecha_ultimo_dato ? ` (activa hasta ${resumen.pm25_fecha_ultimo_dato})` : ""}</span>`
              : "";
          return {
            html: `<strong>${props.nombre ?? resumen.comuna}</strong><br/>Score AHP: ${resumen.score_multicriteria.toFixed(2)}<br/>PM2.5 promedio: ${resumen.pm25_promedio != null ? `${resumen.pm25_promedio.toFixed(1)} µg/m³` : "s/d"}${avisoSinZona}${avisoHistorico}`,
            className: "deck-tooltip",
          };
        }}
      >
        <MapGL
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={MAP_STYLE_URLS[mapStyle]}
          maxBounds={MEDELLIN_MAX_BOUNDS}
          reuseMaps
        >
          {searchMarker && (
            <Marker
              longitude={searchMarker.longitude}
              latitude={searchMarker.latitude}
              anchor="bottom"
            >
              <MapPinIcon
                size={32}
                weight="fill"
                className="text-critical drop-shadow-md"
                aria-hidden="true"
              />
            </Marker>
          )}

          {layers.estacionesPm25 &&
            estacionesPm25Query.data?.map((estacion) => (
              <Marker
                key={estacion.id}
                longitude={estacion.lon}
                latitude={estacion.lat}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setEstacionPopupId((current) => (current === estacion.id ? null : estacion.id));
                }}
              >
                <button
                  type="button"
                  aria-label={`Estación de monitoreo ${estacion.nombre}`}
                  onMouseEnter={() => setEstacionPopupId(estacion.id)}
                  onMouseLeave={() =>
                    setEstacionPopupId((current) => (current === estacion.id ? null : current))
                  }
                  className="flex size-7 items-center justify-center rounded-full border-2 border-data-sky bg-card/95 text-data-sky shadow-md backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BroadcastIcon size={16} weight="bold" aria-hidden="true" />
                </button>
              </Marker>
            ))}

          {layers.estacionesPm25 && estacionPopup && (
            <Popup
              longitude={estacionPopup.lon}
              latitude={estacionPopup.lat}
              anchor="top"
              offset={12}
              closeButton={false}
              closeOnClick={false}
              onClose={() => setEstacionPopupId(null)}
            >
              <div className="text-xs">
                <p className="font-semibold text-foreground">{estacionPopup.nombre}</p>
                <p className="mt-0.5 text-muted-foreground">Comuna: {estacionPopup.comuna_asignada}</p>
                <p className="mt-0.5 text-foreground">
                  Última lectura:{" "}
                  <strong>{estacionPopup.valor_ug_m3.toFixed(1)} µg/m³</strong>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  {new Date(estacionPopup.fecha_lectura).toLocaleString("es-CO")}
                </p>
              </div>
            </Popup>
          )}
        </MapGL>
      </DeckGL>

      {layers.arbolesSau && arbolesSauZoomCercano && arbolesPuntosQuery.data?.truncado && (
        // Centrado y levantado (`bottom-20`, no `bottom-4`): la esquina
        // inferior izquierda es la región fija de controles menores
        // (`CopyLinkButton`/`ComunaKeyboardSelector`, ver `MapaClient`) —
        // este aviso es transitorio, no un control, y al estar centrado
        // podría invadir esa esquina en pantallas angostas si compartiera
        // el mismo `bottom-4`.
        <div className="absolute inset-x-4 bottom-20 z-10 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-md border border-border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-md backdrop-blur">
          Hay más árboles en esta vista de los que se muestran ({arbolesPuntosQuery.data.limite} máx.) — acerca más el zoom para verlos todos.
        </div>
      )}
    </div>
  );
}
