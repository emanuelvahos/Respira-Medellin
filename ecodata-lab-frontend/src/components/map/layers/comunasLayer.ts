import { GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { Feature, Geometry, Polygon, MultiPolygon, Position } from "geojson";
import type { ComunaProperties, ComunasFeatureCollection } from "@/types/comuna";
import type { ResumenRecomendacionComuna } from "@/types/siembra";
import { interpolateTokenRamp } from "@/lib/map/colorTokens";
import { normalizeComunaName } from "@/lib/map/matchComuna";

/** Rampa semántica de prioridad AHP: baja (vegetation) -> media (warning) -> alta (critical). */
const SCORE_COLOR_RAMP = ["vegetation", "warning", "critical"];
const MAX_ELEVATION_M = 2500;

/** Alpha de relleno para comunas CON zona de siembra identificada (recomendación completa). */
const ALPHA_CON_ZONA = { selected: 0.95, hovered: 0.85, base: 0.7 };
/**
 * Alpha reducida para comunas con score AHP pero SIN zona de siembra viable
 * (`tiene_zona_siembra: false`): relleno visiblemente más translúcido/"lavado"
 * que las comunas con recomendación completa, para que nunca se vean
 * equivalentes solo por su altura/color base.
 */
const ALPHA_SIN_ZONA = { selected: 0.55, hovered: 0.48, base: 0.35 };

/** Borde grueso y de alto contraste (token `foreground`) para marcar, sin
 * depender del tooltip, que la comuna tiene prioridad calculada pero NINGÚN
 * sitio de siembra concreto identificado. */
const LINE_WIDTH_SIN_ZONA = 4;
const LINE_WIDTH_DEFAULT = 1;

export type ComunaFeature = Feature<Geometry, ComunaProperties>;

/**
 * Comunas con PM2.5 ESTIMADO por interpolación IDW (no medido): Popular,
 * Manrique, Doce de Octubre. Necesitan un TERCER tratamiento visual,
 * distinguible tanto de las comunas con dato medido como de las 4 comunas
 * "score sin zona de siembra" (borde grueso sólido) — aquí se suma un
 * punteado a lo largo del borde de la comuna (`buildDottedBoundaryPoints`),
 * porque `GeoJsonLayer` no soporta patrones de relleno (hachurado) nativos y
 * el proyecto no depende de `@deck.gl/extensions` (línea punteada real) ni
 * de una librería de geometría (turf) para generar un buffer/offset.
 */
const PUNTOS_POR_SEGMENTO = 6;
const DOT_RADIUS_PX = 2.5;

/** Muestrea puntos equiespaciados (por índice, no por distancia real —
 * suficiente para una señal visual, no para precisión geométrica) a lo largo
 * de cada anillo de un Polygon/MultiPolygon, para dibujar un borde punteado
 * encima del borde sólido normal. */
function buildDottedBoundaryPoints(geometry: Geometry): Position[] {
  const rings: Position[][] = [];
  if (geometry.type === "Polygon") {
    rings.push(...(geometry as Polygon).coordinates);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of (geometry as MultiPolygon).coordinates) rings.push(...polygon);
  }

  const puntos: Position[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      for (let j = 0; j < PUNTOS_POR_SEGMENTO; j++) {
        const t = j / PUNTOS_POR_SEGMENTO;
        puntos.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
      }
    }
  }
  return puntos;
}

/**
 * CUARTO tratamiento visual: Altavista (`pm25_tipo_dato === "historico"`,
 * PM2.5 real pero de una estación ya inactiva — MED-ALTA2/Corantioquia).
 * Debe ser inequívocamente distinto de los otros 3 (relleno translúcido
 * "sin zona", borde punteado rojo "interpolado"): usamos un ícono de
 * reloj/calendario ⏱ flotando sobre el centroide de la comuna — comunica
 * "esto es real pero viejo" sin depender de hachurado/dash (no disponible
 * sin `@deck.gl/extensions`), y un borde sólido de color distinto
 * (`data-sky`, ni `critical` ni `foreground`) para reforzar la señal aunque
 * el ícono no sea visible en un zoom muy alejado.
 */
function computeCentroid(geometry: Geometry): Position {
  const rings: Position[][] = [];
  if (geometry.type === "Polygon") {
    rings.push((geometry as Polygon).coordinates[0]);
  } else if (geometry.type === "MultiPolygon") {
    // Usa el anillo exterior del polígono con más vértices (aproximación
    // razonable del polígono "principal" quan una comuna tiene islas/huecos).
    const exteriors = (geometry as MultiPolygon).coordinates.map((p) => p[0]);
    exteriors.sort((a, b) => b.length - a.length);
    if (exteriors[0]) rings.push(exteriors[0]);
  }
  const ring = rings[0];
  if (!ring || !ring.length) return [0, 0];
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
  }
  return [sumX / ring.length, sumY / ring.length];
}

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

  // Puntos punteados a lo largo del borde de las comunas con PM2.5
  // interpolado (IDW) — capa aparte, dibujada encima del borde sólido.
  const dottedPoints = comunas.features.flatMap((feature) => {
    const key = normalizeComunaName(feature.properties.nombre);
    const resumen = resumenPorComuna.get(key);
    if (resumen?.pm25_tipo_dato !== "interpolado") return [];
    return buildDottedBoundaryPoints(feature.geometry);
  });

  // Centroides de las comunas con PM2.5 histórico/no-vigente (Altavista, hoy
  // la única) — cuarto tratamiento visual, un badge flotante encima del polígono.
  const historicoCentroides = comunas.features.flatMap((feature) => {
    const key = normalizeComunaName(feature.properties.nombre);
    const resumen = resumenPorComuna.get(key);
    if (resumen?.pm25_tipo_dato !== "historico") return [];
    return [{ position: computeCentroid(feature.geometry) }];
  });

  const historicoBadgeLayer = new TextLayer<{ position: Position }>({
    id: "comunas-pm25-historico-badge",
    data: historicoCentroides,
    getPosition: (d) => [d.position[0], d.position[1], 0],
    getText: () => "⏱",
    getSize: 26,
    sizeUnits: "pixels",
    getColor: interpolateTokenRamp(["data-sky"], 0, 1),
    background: true,
    getBackgroundColor: interpolateTokenRamp(["background"], 0, 0.85),
    backgroundPadding: [6, 4, 6, 4],
    pickable: false,
  });

  const interpoladoDotsLayer = new ScatterplotLayer<Position>({
    id: "comunas-pm25-interpolado-punteado",
    data: dottedPoints,
    getPosition: (d) => [d[0], d[1], 0],
    getRadius: DOT_RADIUS_PX,
    radiusUnits: "pixels",
    getFillColor: interpolateTokenRamp(["critical"], 0, 1),
    pickable: false,
  });

  const baseLayer = new GeoJsonLayer<ComunaProperties>({
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
      if (!resumen) {
        const alpha = isSelected ? 0.95 : isHovered ? 0.85 : 0.7;
        return interpolateTokenRamp(["muted-foreground"], 0, alpha * 0.4);
      }
      // Comunas sin zona de siembra viable (`tiene_zona_siembra: false`) o
      // con PM2.5 interpolado (`pm25_tipo_dato === "interpolado"`): mismo
      // color de prioridad AHP, pero notablemente más translúcido — nunca
      // deben leerse igual que una comuna con recomendación completa.
      const alphaScale = resumen.tiene_zona_siembra ? ALPHA_CON_ZONA : ALPHA_SIN_ZONA;
      const alpha = isSelected ? alphaScale.selected : isHovered ? alphaScale.hovered : alphaScale.base;
      const t = (resumen.score_multicriteria - min) / (max - min);
      return interpolateTokenRamp(SCORE_COLOR_RAMP, t, alpha);
    },
    getLineColor: (feature: ComunaFeature) => {
      const key = normalizeComunaName(feature.properties.nombre);
      const resumen = resumenPorComuna.get(key);
      // PM2.5 interpolado (IDW, Popular/Manrique/Doce de Octubre): borde de
      // color distinto (`critical`) al de "sin zona de siembra" (`foreground`)
      // — nunca deben confundirse entre sí ni con el borde normal — sumado al
      // punteado del borde (ver `interpoladoDotsLayer` arriba y MapLegend).
      if (resumen?.pm25_tipo_dato === "interpolado") {
        return interpolateTokenRamp(["critical"], 0, 1);
      }
      // PM2.5 histórico/no-vigente (Altavista): borde `data-sky`, un color
      // que no se usa en ningún otro estado del mapa — nunca se confunde con
      // el borde punteado rojo "interpolado" ni con el borde grueso neutro
      // "sin zona de siembra". Se refuerza con el badge de reloj (arriba).
      if (resumen?.pm25_tipo_dato === "historico") {
        return interpolateTokenRamp(["data-sky"], 0, 1);
      }
      // Borde de alto contraste para comunas con score pero sin zona de
      // siembra: distingue esta categoría del resto sin depender del tooltip
      // (ver también MapLegend, que explica esta categoría).
      if (resumen && !resumen.tiene_zona_siembra) {
        return interpolateTokenRamp(["foreground"], 0, 1);
      }
      return key === selectedComuna
        ? interpolateTokenRamp(["foreground"], 0, 1)
        : interpolateTokenRamp(["border"], 0, 1);
    },
    getLineWidth: (feature: ComunaFeature) => {
      const resumen = resumenPorComuna.get(normalizeComunaName(feature.properties.nombre));
      if (resumen?.pm25_tipo_dato === "interpolado") return LINE_WIDTH_SIN_ZONA;
      if (resumen?.pm25_tipo_dato === "historico") return LINE_WIDTH_SIN_ZONA;
      return resumen && !resumen.tiene_zona_siembra ? LINE_WIDTH_SIN_ZONA : LINE_WIDTH_DEFAULT;
    },
    lineWidthMinPixels: 1,
    lineWidthUnits: "pixels",
    updateTriggers: {
      getFillColor: [selectedComuna, hoveredComuna, resumenPorComuna],
      getElevation: [resumenPorComuna],
      getLineColor: [selectedComuna, resumenPorComuna],
      getLineWidth: [resumenPorComuna],
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

  return [baseLayer, interpoladoDotsLayer, historicoBadgeLayer];
}
