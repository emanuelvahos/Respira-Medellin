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
