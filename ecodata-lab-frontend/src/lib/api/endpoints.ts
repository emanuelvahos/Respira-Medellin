export const endpoints = {
  comunas: "/api/comunas",
  comunasNombres: "/api/comunas/nombres",
  auditoriaEstaciones: "/api/comunas/estaciones/auditoria",
  pm25: "/api/pm25",
  pm25Estaciones: "/api/pm25/estaciones",
  relacionesAnuales: "/api/pm25/relaciones-anuales",
  zonasSiembra: "/api/siembra/zonas",
  zonasSiembraGeojson: "/api/siembra/zonas/geojson",
  resumenComuna: "/api/siembra/resumen-comuna",
  zonasVerdes: "/api/zonas-verdes",
  arbolesResumenComuna: "/api/arboles/resumen-comuna",
  arbolesBalance: "/api/arboles/balance",
  ahpV2: "/api/siembra/ahp-v2",
  ahpV2Resumen: "/api/siembra/ahp-v2/resumen",
  saludResumenComuna: "/api/salud/resumen-comuna",
  poblacionComuna: "/api/comunas/poblacion",
} as const;

/** `/api/siembra/zona/{id}/detalle` (Fase E2) — detalle real de una zona (área, especie, ficha botánica). */
export function zonaSiembraDetalleUrl(idPoligono: number): string {
  return `/api/siembra/zona/${idPoligono}/detalle`;
}

/** `/api/siembra/ranking-comunas` toma pesos como query params — no es una ruta estática. */
export function rankingComunasUrl(pesos: {
  pesoPm25: number;
  pesoDeficit: number;
  pesoArea: number;
}): string {
  const params = new URLSearchParams({
    peso_pm25: String(pesos.pesoPm25),
    peso_deficit: String(pesos.pesoDeficit),
    peso_area: String(pesos.pesoArea),
  });
  return `/api/siembra/ranking-comunas?${params.toString()}`;
}

/** `/api/siembra/ranking-comunas/export` — PDF/Excel del ranking con los pesos actuales de pantalla. */
export function rankingComunasExportUrl(
  pesos: { pesoPm25: number; pesoDeficit: number; pesoArea: number },
  formato: "pdf" | "excel",
): string {
  const params = new URLSearchParams({
    formato,
    peso_pm25: String(pesos.pesoPm25),
    peso_deficit: String(pesos.pesoDeficit),
    peso_area: String(pesos.pesoArea),
  });
  return `/api/siembra/ranking-comunas/export?${params.toString()}`;
}

/** `/api/siembra/proyeccion` (Fase F4) — curva de maduración estimada del
 * plan de siembra, nunca un valor de PM2.5 en µg/kg (ver backend/README.md,
 * "Curva de maduración del plan de siembra (Fase F4)"). */
export function proyeccionMaduracionUrl(anio: number, escenario: string): string {
  const params = new URLSearchParams({ anio: String(anio), escenario });
  return `/api/siembra/proyeccion?${params.toString()}`;
}

/** `/api/arboles/clusters` — grid espacial (para zoom alejado del mapa). */
export function arbolesClustersUrl(cellSizeDeg?: number): string {
  if (cellSizeDeg == null) return "/api/arboles/clusters";
  return `/api/arboles/clusters?${new URLSearchParams({ cell_size_deg: String(cellSizeDeg) }).toString()}`;
}

export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/** `/api/arboles/puntos` — árboles individuales reales dentro de un bbox,
 * usado por la capa clustered/puntos del mapa a zoom cercano (tope por
 * defecto del backend). */
export function arbolesPuntosUrl(bbox: Bbox, limit?: number): string {
  const params = new URLSearchParams({
    min_lon: String(bbox.minLon),
    min_lat: String(bbox.minLat),
    max_lon: String(bbox.maxLon),
    max_lat: String(bbox.maxLat),
  });
  if (limit != null) params.set("limit", String(limit));
  return `/api/arboles/puntos?${params.toString()}`;
}
