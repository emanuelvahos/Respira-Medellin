"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DeckGL } from "@deck.gl/react";
import { FlyToInterpolator, type PickingInfo } from "@deck.gl/core";
import MapGL, { type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  useComunas,
  useResumenComuna,
  useZonasSiembraGeojson,
  useZonasVerdes,
  usePM25,
  useEstacionesPM25,
} from "@/lib/api/queries";
import {
  COMUNA_FLYTO_BEARING,
  COMUNA_FLYTO_PITCH,
  COMUNA_FLYTO_ZOOM,
  useMapStore,
  type MapViewState,
} from "@/store/mapStore";
import { createComunasLayer } from "@/components/map/layers/comunasLayer";
import { createZonasSiembraLayer } from "@/components/map/layers/zonasSiembraLayer";
import { createZonasVerdesLayer } from "@/components/map/layers/zonasVerdesLayer";
import {
  buildPm25ParticleField,
  createPm25ParticlesLayer,
  evaluatePm25Particles,
} from "@/components/map/layers/pm25Layer";
import type { ResumenRecomendacionComuna } from "@/types/siembra";
import { normalizeComunaName } from "@/lib/map/matchComuna";
import { approximateCentroid } from "@/lib/map/geoCentroid";
import { randomPointsInPolygon } from "@/lib/map/scatterInPolygon";
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
  } = useMapStore();

  const reducedMotion = usePrefersReducedMotion();
  const mapRef = useRef<MapRef>(null);
  const [cameraState, setCameraState] = useState<MapCameraState | null>(null);

  const comunasQuery = useComunas();
  const resumenQuery = useResumenComuna();
  const zonasSiembraQuery = useZonasSiembraGeojson();
  const zonasVerdesQuery = useZonasVerdes();
  const pm25Query = usePM25();
  const estacionesPm25Query = useEstacionesPM25();

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
        ? createZonasVerdesLayer({
            data: zonasVerdesQuery.data,
            isError: zonasVerdesQuery.isError,
          })
        : null,
    [layers.zonasVerdes, zonasVerdesQuery.data, zonasVerdesQuery.isError],
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

  const deckLayers = useMemo(
    () => [zonasVerdesLayer, pm25Layer, zonasSiembraLayer, comunasLayer].filter(Boolean),
    [zonasVerdesLayer, pm25Layer, zonasSiembraLayer, comunasLayer],
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

    const duration = reducedMotion ? 0 : 1800;
    setViewState({
      longitude: centroid[0],
      latitude: centroid[1],
      zoom: COMUNA_FLYTO_ZOOM,
      pitch: COMUNA_FLYTO_PITCH,
      bearing: COMUNA_FLYTO_BEARING,
      transitionDuration: duration,
      transitionInterpolator: new FlyToInterpolator({ speed: 1.6 }),
    } as MapViewState);

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

  const comunaCentroid = useMemo(() => {
    if (!selectedComuna) return null;
    const feature = comunasQuery.data?.features.find(
      (f) => normalizeComunaName(f.properties.nombre) === selectedComuna,
    );
    return feature ? approximateCentroid(feature.geometry) : null;
  }, [selectedComuna, comunasQuery.data]);

  const treePoints = useMemo<TreePoint[]>(() => {
    if (!treesRevealed || !comunaCentroid) return [];
    const feature = comunasQuery.data?.features.find(
      (f) => normalizeComunaName(f.properties.nombre) === selectedComuna,
    );
    if (!feature) return [];

    const registrosPm25 = pm25Query.data?.filter(
      (r) => normalizeComunaName(r.comuna) === selectedComuna,
    );
    const arbolesTotales = registrosPm25?.length
      ? Math.max(...registrosPm25.map((r) => r.cantidad_arboles_totales))
      : 0;
    // Muestra representativa (no son coordenadas reales de árboles, ver
    // src/lib/map/scatterInPolygon.ts): la CANTIDAD sí viene de datos reales.
    const nExisting = Math.min(
      MAX_EXISTING_TREE_INSTANCES,
      Math.max(20, Math.round(arbolesTotales / 25)),
    );
    const existingPoints = randomPointsInPolygon(feature.geometry, nExisting).map(
      ([lon, lat]): TreePoint => ({ lon, lat, kind: "existing" }),
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
  }, [treesRevealed, comunaCentroid, comunasQuery.data, selectedComuna, pm25Query.data, zonasSiembraQuery.data]);

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
        viewState={viewState}
        onViewStateChange={({ viewState: next }) =>
          setViewState(next as typeof viewState)
        }
        controller
        layers={deckLayers}
        getTooltip={({ object }: PickingInfo) => {
          if (!object?.properties) return null;
          const props = object.properties as { comuna?: string; nombre?: string };
          const resumen = props.nombre
            ? resumenPorComuna.get(normalizeComunaName(props.nombre))
            : undefined;
          if (!resumen) return null;
          return {
            html: `<strong>${props.nombre ?? resumen.comuna}</strong><br/>Score AHP: ${resumen.score_multicriteria.toFixed(2)}<br/>PM2.5 promedio: ${resumen.pm25_promedio != null ? `${resumen.pm25_promedio.toFixed(1)} µg/m³` : "s/d"}`,
            className: "deck-tooltip",
          };
        }}
      >
        <MapGL
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          reuseMaps
        />
      </DeckGL>

      {treesRevealed && comunaCentroid && cameraState && (
        <TreeInstances
          origin={comunaCentroid}
          cameraState={cameraState}
          points={treePoints}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  );
}
