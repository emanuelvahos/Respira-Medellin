import { GeoJsonLayer } from "@deck.gl/layers";
import type { Feature, Geometry } from "geojson";
import type { ZonaPriorizadaSiembraProperties } from "@/types/siembra";
import { tokenToRGBA } from "@/lib/map/colorTokens";

/** Ciclo de colores categóricos sancionado por el design system para series de datos. */
const SPECIES_COLOR_TOKENS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

export type ZonaSiembraFeature = Feature<
  Geometry,
  ZonaPriorizadaSiembraProperties
>;

function speciesColorIndex(especie: string): number {
  let hash = 0;
  for (let i = 0; i < especie.length; i += 1) {
    hash = (hash * 31 + especie.charCodeAt(i)) % SPECIES_COLOR_TOKENS.length;
  }
  return hash;
}

export function createZonasSiembraLayer({
  data,
}: {
  data: GeoJSON.FeatureCollection<Geometry, ZonaPriorizadaSiembraProperties> | undefined;
}) {
  if (!data) return null;

  return new GeoJsonLayer<ZonaPriorizadaSiembraProperties>({
    id: "zonas-siembra",
    // ~1.649 polígonos: se simplifica en la validación/carga (Fase 1); aquí solo
    // se evita reconstruir geometría en cada render (ver useMemo en MapCanvas).
    data,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    getFillColor: (feature: ZonaSiembraFeature) => {
      const idx = speciesColorIndex(feature.properties.especie_recomendada);
      return tokenToRGBA(SPECIES_COLOR_TOKENS[idx], 0.75);
    },
    getLineColor: () => tokenToRGBA("earth", 0.6),
    lineWidthMinPixels: 1,
  });
}
