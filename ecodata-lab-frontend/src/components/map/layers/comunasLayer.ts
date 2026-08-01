import { GeoJsonLayer } from "@deck.gl/layers";
import type { Feature, Geometry } from "geojson";
import type { ComunaProperties, ComunasFeatureCollection } from "@/types/comuna";
import type { ResumenRecomendacionComuna } from "@/types/siembra";
import { interpolateTokenRamp } from "@/lib/map/colorTokens";
import { normalizeComunaName } from "@/lib/map/matchComuna";

/** Rampa semántica de prioridad AHP: baja (vegetation) -> media (warning) -> alta (critical). */
const SCORE_COLOR_RAMP = ["vegetation", "warning", "critical"];
const MAX_ELEVATION_M = 2500;

export type ComunaFeature = Feature<Geometry, ComunaProperties>;

function normalizeScoreRange(resumenes: ResumenRecomendacionComuna[]) {
  const scores = resumenes.map((r) => r.score_multicriteria);
  const min = scores.length ? Math.min(...scores) : 0;
  const max = scores.length ? Math.max(...scores) : 1;
  return { min, max: max > min ? max : min + 1 };
}

export function createComunasLayer({
  comunas,
  resumenPorComuna,
  selectedComuna,
  hoveredComuna,
  onClick,
  onHover,
}: {
  comunas: ComunasFeatureCollection | undefined;
  resumenPorComuna: Map<string, ResumenRecomendacionComuna>;
  selectedComuna: string | null;
  hoveredComuna: string | null;
  onClick: (comuna: string | null) => void;
  onHover: (comuna: string | null) => void;
}) {
  if (!comunas) return null;

  const { min, max } = normalizeScoreRange(Array.from(resumenPorComuna.values()));

  return new GeoJsonLayer<ComunaProperties>({
    id: "comunas",
    data: comunas as unknown as GeoJSON.FeatureCollection,
    pickable: true,
    stroked: true,
    filled: true,
    extruded: true,
    wireframe: true,
    getElevation: (feature: ComunaFeature) => {
      const resumen = resumenPorComuna.get(normalizeComunaName(feature.properties.nombre));
      if (!resumen) return 0;
      const t = (resumen.score_multicriteria - min) / (max - min);
      return t * MAX_ELEVATION_M;
    },
    getFillColor: (feature: ComunaFeature) => {
      const key = normalizeComunaName(feature.properties.nombre);
      const resumen = resumenPorComuna.get(key);
      const isSelected = key === selectedComuna;
      const isHovered = key === hoveredComuna;
      const alpha = isSelected ? 0.95 : isHovered ? 0.85 : 0.7;
      if (!resumen) return interpolateTokenRamp(["muted-foreground"], 0, alpha * 0.4);
      const t = (resumen.score_multicriteria - min) / (max - min);
      return interpolateTokenRamp(SCORE_COLOR_RAMP, t, alpha);
    },
    getLineColor: (feature: ComunaFeature) =>
      normalizeComunaName(feature.properties.nombre) === selectedComuna
        ? interpolateTokenRamp(["foreground"], 0, 1)
        : interpolateTokenRamp(["border"], 0, 1),
    lineWidthMinPixels: 1,
    updateTriggers: {
      getFillColor: [selectedComuna, hoveredComuna, resumenPorComuna],
      getElevation: [resumenPorComuna],
      getLineColor: [selectedComuna],
    },
    onClick: ({ object }) => {
      const feature = object as ComunaFeature | undefined;
      onClick(feature ? normalizeComunaName(feature.properties.nombre) : null);
    },
    onHover: ({ object }) => {
      const feature = object as ComunaFeature | undefined;
      onHover(feature ? normalizeComunaName(feature.properties.nombre) : null);
    },
  });
}
