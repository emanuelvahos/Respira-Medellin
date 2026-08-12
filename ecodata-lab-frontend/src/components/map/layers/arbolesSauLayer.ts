import { ScatterplotLayer } from "@deck.gl/layers";
import type { ArbolPunto, ClusterArboles } from "@/types/arbolSau";
import { tokenToRGBA } from "@/lib/map/colorTokens";

/**
 * Radio proporcional a la raíz cuadrada del conteo (área ~ conteo, no el
 * radio directamente) para que celdas con 10x más árboles no se vean 10x más
 * grandes en diámetro — mismo criterio visual que los clusters del propio
 * visor del SAU (círculos rojos/amarillos por comuna).
 */
const CLUSTER_MIN_RADIUS_PX = 4;
const CLUSTER_MAX_RADIUS_PX = 32;
const CLUSTER_RADIUS_SCALE = 2.2;

function clusterRadiusPx(cantidad: number): number {
  return Math.min(
    CLUSTER_MAX_RADIUS_PX,
    CLUSTER_MIN_RADIUS_PX + CLUSTER_RADIUS_SCALE * Math.sqrt(cantidad),
  );
}

export function createArbolesClustersLayer({
  data,
}: {
  data: ClusterArboles[] | undefined;
}) {
  if (!data) return null;

  return new ScatterplotLayer<ClusterArboles>({
    id: "arboles-sau-clusters",
    data,
    pickable: true,
    stroked: true,
    filled: true,
    radiusUnits: "pixels",
    getPosition: (d) => [d.lon, d.lat],
    getRadius: (d) => clusterRadiusPx(d.cantidad),
    getFillColor: () => tokenToRGBA("vegetation", 0.55),
    getLineColor: () => tokenToRGBA("vegetation", 0.9),
    lineWidthMinPixels: 1,
    updateTriggers: {
      getRadius: [data],
    },
  });
}

export function createArbolesPuntosLayer({
  data,
}: {
  data: ArbolPunto[] | undefined;
}) {
  if (!data) return null;

  return new ScatterplotLayer<ArbolPunto>({
    id: "arboles-sau-puntos",
    data,
    pickable: true,
    stroked: true,
    filled: true,
    radiusUnits: "pixels",
    getPosition: (d) => [d.lon, d.lat],
    getRadius: 4,
    getFillColor: () => tokenToRGBA("vegetation", 0.85),
    getLineColor: () => tokenToRGBA("earth", 0.9),
    lineWidthMinPixels: 0.5,
  });
}
