import { GeoJsonLayer } from "@deck.gl/layers";
import type { Feature, Geometry } from "geojson";
import type { ZonaVerdeInventarioProperties } from "@/types/zonaVerde";
import { tokenToRGBA } from "@/lib/map/colorTokens";

/**
 * Color por `cober_dom` (cobertura dominante, 6 valores en el dataset real de
 * GeoMedellín): reutiliza los tokens categóricos (`chart-1..5`) más los
 * semánticos `vegetation`/`earth` ya existentes en el design system, en vez
 * de sumar colores sueltos — cubre exactamente las 6 categorías observadas.
 */
const COBER_DOM_COLOR_TOKENS: Record<string, string> = {
  Arboles: "vegetation",
  Grama: "chart-1",
  Jardin: "chart-2",
  Arbustos: "chart-3",
  Tierra: "earth",
  "Piso duro": "chart-5",
};
const FALLBACK_COLOR_TOKEN = "chart-4";

export type ZonaVerdeFeature = Feature<Geometry, ZonaVerdeInventarioProperties>;

export function createZonasVerdesLayer({
  data,
}: {
  data: GeoJSON.FeatureCollection<Geometry, ZonaVerdeInventarioProperties> | undefined;
}) {
  if (!data) return null;

  return new GeoJsonLayer<ZonaVerdeInventarioProperties>({
    id: "zonas-verdes",
    // 48.348 polígonos ya simplificados/reproyectados en el backend
    // (data_loader.py); aquí solo se evita reconstruir geometría en cada
    // render (ver useMemo en MapCanvas).
    data,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    getFillColor: (feature: ZonaVerdeFeature) => {
      const token = COBER_DOM_COLOR_TOKENS[feature.properties.cober_dom] ?? FALLBACK_COLOR_TOKEN;
      return tokenToRGBA(token, 0.6);
    },
    getLineColor: () => tokenToRGBA("vegetation", 0.3),
    lineWidthMinPixels: 1,
    updateTriggers: {
      getFillColor: [data],
    },
  });
}
