export const endpoints = {
  comunas: "/api/comunas",
  auditoriaEstaciones: "/api/comunas/estaciones/auditoria",
  pm25: "/api/pm25",
  pm25Estaciones: "/api/pm25/estaciones",
  relacionesAnuales: "/api/pm25/relaciones-anuales",
  zonasSiembra: "/api/siembra/zonas",
  zonasSiembraGeojson: "/api/siembra/zonas/geojson",
  resumenComuna: "/api/siembra/resumen-comuna",
  zonasVerdes: "/api/zonas-verdes",
  arbolesResumenComuna: "/api/arboles/resumen-comuna",
  saludResumenComuna: "/api/salud/resumen-comuna",
  poblacionComuna: "/api/comunas/poblacion",
} as const;

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

/** `/api/arboles/clusters` — grid espacial (para zoom alejado del mapa). */
export function arbolesClustersUrl(cellSizeDeg?: number): string {
  if (cellSizeDeg == null) return "/api/arboles/clusters";
  return `/api/arboles/clusters?${new URLSearchParams({ cell_size_deg: String(cellSizeDeg) }).toString()}`;
}

export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

/** `/api/arboles/puntos` — árboles individuales reales dentro del viewport (para zoom cercano). */
export function arbolesPuntosUrl(bbox: Bbox): string {
  const params = new URLSearchParams({
    min_lon: String(bbox.minLon),
    min_lat: String(bbox.minLat),
    max_lon: String(bbox.maxLon),
    max_lat: String(bbox.maxLat),
  });
  return `/api/arboles/puntos?${params.toString()}`;
}
