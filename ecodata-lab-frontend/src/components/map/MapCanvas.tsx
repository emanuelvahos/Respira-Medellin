"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import type { PickingInfo } from "@deck.gl/core";
import MapGL, { Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import {
  useComunas,
  useResumenComuna,
  useZonasSiembraGeojson,
  useZonasVerdes,
  usePM25,
  useEstacionesPM25,
  useArbolesClusters,
  useArbolesPuntos,
} from "@/lib/api/queries";
import {
  ARBOLES_SAU_PUNTOS_MIN_ZOOM,
  COMUNA_FLYTO_BEARING,
  COMUNA_FLYTO_PITCH,
  COMUNA_FLYTO_ZOOM,
  MEDELLIN_MAX_BOUNDS,
  MEDELLIN_MAX_ZOOM,
  MEDELLIN_MIN_ZOOM,
  useMapStore,
} from "@/store/mapStore";
import type { Bbox } from "@/lib/api/endpoints";
import { createComunasLayer } from "@/components/map/layers/comunasLayer";
import { createZonasSiembraLayer } from "@/components/map/layers/zonasSiembraLayer";
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
import { bboxOfGeometry, randomPointsInPolygon } from "@/lib/map/scatterInPolygon";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { TreeInstances, type TreePoint } from "@/components/trees/TreeInstances";
import type { MapCameraState } from "@/lib/map/mapboxThreeSync";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const MAX_EXISTING_TREE_INSTANCES = 220;
const MAX_RECOMMENDED_TREE_INSTANCES = 220;

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
    treesRevealed,
    setTreesRevealed,
    searchMarker,
  } = useMapStore();

  const reducedMotion = usePrefersReducedMotion();
  const mapRef = useRef<MapRef>(null);
  const [cameraState, setCameraState] = useState<MapCameraState | null>(null);

  // Memoizado: DeckGL trata un cambio de identidad de `viewState` como un
  // movimiento de cámara real y lo reaplica sobre Mapbox (`Mapbox.setProps`
  // -> `map._render` -> evento "move"). Sin memo, cada re-render (p. ej. los
  // que dispara `setCameraState` en el efecto de más abajo, en cada "move")
  // reconstruye este objeto por referencia y reinyecta el mismo movimiento,
  // que vuelve a disparar "move" -> setCameraState -> re-render: bucle
  // infinito ("Maximum update depth exceeded"), solo visible una vez que
  // `treesRevealed` activa ese efecto.
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
  const pm25Query = usePM25();
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

  const zonasSiembraLayer = useMemo(
    () =>
      layers.zonasSiembra
        ? createZonasSiembraLayer({ data: zonasSiembraQuery.data })
        : null,
    [layers.zonasSiembra, zonasSiembraQuery.data],
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
        zonasSiembraLayer,
        comunasLayer,
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

  // --- "Respiro Urbano": flyTo + revelación de árboles 3D al seleccionar comuna ---
  //
  // IMPORTANTE: DeckGL controla el `viewState` del mapa subyacente (lo pasa a
  // MapGL como componente controlado). Llamar a `map.flyTo()` imperativamente
  // sobre la instancia de Mapbox NO funciona aquí: DeckGL reimpone el
  // `viewState` de React en cada render y cancela la animación de Mapbox casi
  // de inmediato. Por eso el vuelo se dispara actualizando el `viewState` del
  // store con un `transitionInterpolator` de deck.gl (`FlyToInterpolator`),
  // que es quien realmente anima la cámara compartida por deck.gl + Mapbox.
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

    const timeout = setTimeout(() => {
      setIsFlyingTo(false);
      setTreesRevealed(true);
    }, duration + 50);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe re-ejecutarse cuando cambia la comuna seleccionada o arranca el flyTo.
  }, [selectedComuna, isFlyingTo]);

  // Cámara en vivo (para sincronizar TreeInstances) mientras los árboles están visibles.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !treesRevealed) return;

    const updateCameraState = () => {
      const center = map.getCenter();
      setCameraState({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    };
    updateCameraState();
    map.on("move", updateCameraState);
    return () => {
      map.off("move", updateCameraState);
    };
  }, [treesRevealed]);

  const selectedComunaFeature = useMemo(() => {
    if (!selectedComuna) return null;
    return (
      comunasQuery.data?.features.find(
        (f) => normalizeComunaName(f.properties.nombre) === selectedComuna,
      ) ?? null
    );
  }, [selectedComuna, comunasQuery.data]);

  const comunaCentroid = useMemo(
    () => (selectedComunaFeature ? approximateCentroid(selectedComunaFeature.geometry) : null),
    [selectedComunaFeature],
  );

  // Cuántos árboles "existentes" mostrar en 3D: mismo criterio de cap ya
  // usado antes de esta integración (proporcional al conteo real agregado
  // `cantidad_arboles_totales`, techo MAX_EXISTING_TREE_INSTANCES) — lo
  // único que cambió es que ahora se piden posiciones REALES del SAU con
  // ese mismo tope, en vez de dispersarlas sintéticamente dentro del
  // polígono de la comuna (ver randomPointsInPolygon, todavía usado abajo
  // solo para las zonas "recomendadas", que no son árboles reales).
  const nExistingTrees = useMemo(() => {
    if (!selectedComuna) return 0;
    const registrosPm25 = pm25Query.data?.filter(
      (r) => normalizeComunaName(r.comuna) === selectedComuna,
    );
    const arbolesTotales = registrosPm25?.length
      ? Math.max(...registrosPm25.map((r) => r.cantidad_arboles_totales))
      : 0;
    return Math.min(MAX_EXISTING_TREE_INSTANCES, Math.max(20, Math.round(arbolesTotales / 25)));
  }, [selectedComuna, pm25Query.data]);

  const comunaBbox = useMemo(
    () => (selectedComunaFeature ? bboxOfGeometry(selectedComunaFeature.geometry) : null),
    [selectedComunaFeature],
  );

  // Reutiliza el mismo hook que alimenta la capa clustered del SAU en el
  // mapa (ver arbolesPuntosQuery arriba) — mismo endpoint, mismo hook,
  // solo con un bbox de comuna completa y un `limit` acotado al cap de
  // instancias 3D en vez del bbox de viewport + tope por defecto. El
  // backend ya muestrea aleatoriamente cuando trunca (ver
  // `puntos_en_bbox` en `backend/app/services/arboles.py`), así que no
  // hace falta una segunda pasada de sub-muestreo en el cliente.
  const arbolesExistentesQuery = useArbolesPuntos(
    treesRevealed && nExistingTrees > 0,
    comunaBbox,
    nExistingTrees || undefined,
  );

  const treePoints = useMemo<TreePoint[]>(() => {
    if (!treesRevealed || !comunaCentroid) return [];

    const existingPoints: TreePoint[] = (arbolesExistentesQuery.data?.puntos ?? []).map(
      (p): TreePoint => ({
        lon: p.lon,
        lat: p.lat,
        kind: "existing",
        especie: p.s_especie,
        nombreComun: p.nombre_comun,
        estado: p.s_estado_arbol,
      }),
    );

    const zonasComuna =
      zonasSiembraQuery.data?.features.filter(
        (f) => normalizeComunaName(f.properties.comuna) === selectedComuna,
      ) ?? [];
    const totalCupo = zonasComuna.reduce((acc, f) => acc + f.properties.arboles_cupo_estimado, 0) || 1;
    const recommendedPoints: TreePoint[] = [];
    for (const zona of zonasComuna) {
      const share = Math.round(
        (zona.properties.arboles_cupo_estimado / totalCupo) * MAX_RECOMMENDED_TREE_INSTANCES,
      );
      const n = Math.min(share, 12);
      randomPointsInPolygon(zona.geometry, n).forEach(([lon, lat]) => {
        recommendedPoints.push({ lon, lat, kind: "recommended" });
      });
    }

    return [...existingPoints, ...recommendedPoints];
  }, [
    treesRevealed,
    comunaCentroid,
    arbolesExistentesQuery.data,
    selectedComuna,
    zonasSiembraQuery.data,
  ]);

  // --- Tooltip de especie real al pasar el mouse sobre un árbol "existente" ---
  //
  // TreeInstances renderiza sobre un <canvas> three.js con pointer-events:none
  // (para no bloquear el pan/zoom del mapa subyacente) — por eso el hover no
  // se resuelve con raycasting de R3F, sino proyectando cada punto real a
  // coordenadas de pantalla con `map.project()` (misma instancia de Mapbox
  // que ya usa el resto de MapCanvas) y buscando el árbol más cercano al
  // cursor dentro de un radio en píxeles. Los árboles "recomendados" no
  // tienen especie real todavía, así que no participan de este hover.
  const [hoveredTree, setHoveredTree] = useState<{
    especie: string;
    nombreComun: string | null;
    x: number;
    y: number;
  } | null>(null);

  const existingTreePoints = useMemo(
    () => treePoints.filter((p) => p.kind === "existing"),
    [treePoints],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !treesRevealed || existingTreePoints.length === 0) {
      setHoveredTree(null);
      return;
    }
    const HOVER_RADIUS_PX = 22;

    const handleMouseMove = (e: { point: { x: number; y: number } }) => {
      let closest: { point: TreePoint; distSq: number } | null = null;
      for (const point of existingTreePoints) {
        const screen = map.project([point.lon, point.lat]);
        const dx = screen.x - e.point.x;
        const dy = screen.y - e.point.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= HOVER_RADIUS_PX * HOVER_RADIUS_PX && (!closest || distSq < closest.distSq)) {
          closest = { point, distSq };
        }
      }
      if (!closest) {
        setHoveredTree(null);
        return;
      }
      const screen = map.project([closest.point.lon, closest.point.lat]);
      setHoveredTree({
        especie: closest.point.especie ?? "Especie sin dato",
        nombreComun: closest.point.nombreComun ?? null,
        x: screen.x,
        y: screen.y,
      });
    };
    const handleMouseLeave = () => setHoveredTree(null);

    map.on("mousemove", handleMouseMove);
    map.on("mouseout", handleMouseLeave);
    return () => {
      map.off("mousemove", handleMouseMove);
      map.off("mouseout", handleMouseLeave);
    };
  }, [treesRevealed, existingTreePoints]);

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
          mapStyle="mapbox://styles/mapbox/dark-v11"
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
        </MapGL>
      </DeckGL>

      {layers.arbolesSau && arbolesSauZoomCercano && arbolesPuntosQuery.data?.truncado && (
        <div className="absolute bottom-4 left-4 z-10 rounded-md border border-border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-md backdrop-blur">
          Hay más árboles en esta vista de los que se muestran ({arbolesPuntosQuery.data.limite} máx.) — acerca más el zoom para verlos todos.
        </div>
      )}

      {treesRevealed && comunaCentroid && cameraState && (
        <TreeInstances
          origin={comunaCentroid}
          cameraState={cameraState}
          points={treePoints}
          reducedMotion={reducedMotion}
        />
      )}

      {hoveredTree && (
        <div
          className="deck-tooltip pointer-events-none absolute z-20"
          style={{ left: hoveredTree.x, top: hoveredTree.y, transform: "translate(-50%, -120%)" }}
        >
          <strong>{hoveredTree.especie}</strong>
          {hoveredTree.nombreComun && (
            <>
              <br />
              {hoveredTree.nombreComun}
            </>
          )}
        </div>
      )}
    </div>
  );
}
