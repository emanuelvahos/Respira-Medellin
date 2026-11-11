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

function esDudosa(feature: ZonaSiembraFeature): boolean {
  return feature.properties.viabilidad_auditada === "posible_no_viable";
}

export function createZonasSiembraLayer({
  data,
  mostrarDescartadas = false,
  onClick,
  onHover,
}: {
  data: GeoJSON.FeatureCollection<Geometry, ZonaPriorizadaSiembraProperties> | undefined;
  /**
   * Fase E1: por defecto (`false`) las zonas `posible_no_viable` (auditoría
   * de Fase D) NO se dibujan — decisión explícita del dueño del proyecto de
   * que la recomendación activa por defecto sean solo las zonas
   * consistentes. `true` las vuelve a mostrar con el mismo tratamiento
   * visual ya construido (borde rojo grueso, tooltip de aviso, miniatura
   * satelital al click) — ver el toggle "Mostrar zonas descartadas
   * (auditoría)" en `MapLayerToggles`. Los datos en disco
   * (`zonas_priorizadas_siembra.geojson`) no se tocan: esto es un filtro de
   * presentación, la zona sigue existiendo y se puede reactivar en
   * cualquier momento.
   */
  mostrarDescartadas?: boolean;
  onClick?: (feature: ZonaSiembraFeature | null) => void;
  onHover?: (feature: ZonaSiembraFeature | null) => void;
}) {
  if (!data) return null;

  const features = mostrarDescartadas
    ? data.features
    : data.features.filter((f) => !esDudosa(f as ZonaSiembraFeature));

  return new GeoJsonLayer<ZonaPriorizadaSiembraProperties>({
    id: "zonas-siembra",
    // ~1.649 polígonos: se simplifica en la validación/carga (Fase 1); aquí solo
    // se evita reconstruir geometría en cada render (ver useMemo en MapCanvas).
    data: { type: "FeatureCollection", features },
    pickable: true,
    stroked: true,
    filled: true,
    extruded: false,
    getFillColor: (feature: ZonaSiembraFeature) => {
      const idx = speciesColorIndex(feature.properties.especie_recomendada);
      return tokenToRGBA(SPECIES_COLOR_TOKENS[idx], 0.75);
    },
    // Zonas marcadas por la auditoría de viabilidad (Fase D) como
    // `posible_no_viable` (se solapan con cancha/plaza/unidad deportiva en
    // el inventario real de GeoMedellín, ver backend/README.md) llevan
    // borde rojo grueso cuando `mostrarDescartadas` las trae de vuelta al
    // mapa — no se ocultan ni se recolorea el relleno, el principio de
    // transparencia del proyecto es mostrar la incertidumbre, no
    // esconderla, para quien active el toggle. El resto conserva el borde
    // neutro de siempre.
    getLineColor: (feature: ZonaSiembraFeature) =>
      esDudosa(feature) ? tokenToRGBA("critical", 0.95) : tokenToRGBA("earth", 0.6),
    getLineWidth: (feature: ZonaSiembraFeature) => (esDudosa(feature) ? 3 : 1),
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 1,
    updateTriggers: {
      getLineColor: [features],
      getLineWidth: [features],
    },
    onClick: (info) => onClick?.((info.object as ZonaSiembraFeature | undefined) ?? null),
    onHover: (info) => onHover?.((info.object as ZonaSiembraFeature | undefined) ?? null),
  });
}
