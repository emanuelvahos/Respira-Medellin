import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import {
  arbolesClustersUrl,
  arbolesPuntosUrl,
  endpoints,
  rankingComunasUrl,
  zonaSiembraDetalleUrl,
  type Bbox,
} from "@/lib/api/endpoints";
import {
  comunasFeatureCollectionSchema,
  estacionAuditoriaSchema,
  poblacionComunaSchema,
} from "@/types/comuna";
import { estacionPM25Schema } from "@/types/estacionPM25";
import { integracionPM25ArbolesSchema } from "@/types/pm25";
import { rankingComunaItemSchema, type PesosAhp } from "@/types/rankingComuna";
import {
  recomendacionSiembraZonaSchema,
  resumenRecomendacionComunaSchema,
  zonaSiembraDetalleSchema,
  zonasPriorizadasSiembraFeatureCollectionSchema,
} from "@/types/siembra";
import { zonasVerdesFeatureCollectionSchema } from "@/types/zonaVerde";
import {
  clusterArbolesSchema,
  puntosArbolesResponseSchema,
  resumenArbolesComunaSchema,
} from "@/types/arbolSau";
import { resumenSaludRespiratoriaResponseSchema } from "@/types/saludRespiratoria";

async function fetchAndValidate<Schema extends z.ZodTypeAny>(
  path: string,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const raw = await apiFetch(path);
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Respuesta de ${path} no cumple el esquema esperado: ${result.error.message}`,
    );
  }
  return result.data;
}

export function useComunas() {
  return useQuery({
    queryKey: ["comunas"],
    queryFn: () =>
      fetchAndValidate(endpoints.comunas, comunasFeatureCollectionSchema),
  });
}

/** Solo nombres de las 21 comunas, SIN geometría (~3.2 KB vs. los ~3.5 MB de
 * `useComunas()`) — para vistas que solo necesitan el nombre (ej. el
 * selector de `ComunaComparator` en `/dashboard`), nunca para el mapa. Ver
 * docs/ESTADO_PROYECTO.md, "Aislar la caída de Lighthouse". */
export function useComunasNombres() {
  return useQuery({
    queryKey: ["comunas-nombres"],
    queryFn: () => fetchAndValidate(endpoints.comunasNombres, z.array(z.string())),
  });
}

export function usePM25() {
  return useQuery({
    queryKey: ["pm25"],
    queryFn: () =>
      fetchAndValidate(endpoints.pm25, z.array(integracionPM25ArbolesSchema)),
  });
}

export function useZonasSiembra() {
  return useQuery({
    queryKey: ["zonas-siembra"],
    queryFn: () =>
      fetchAndValidate(
        endpoints.zonasSiembra,
        z.array(recomendacionSiembraZonaSchema),
      ),
  });
}

export function useResumenComuna() {
  return useQuery({
    queryKey: ["resumen-comuna"],
    queryFn: () =>
      fetchAndValidate(
        endpoints.resumenComuna,
        z.array(resumenRecomendacionComunaSchema),
      ),
  });
}

export function useZonasVerdes(enabled = true) {
  return useQuery({
    queryKey: ["zonas-verdes"],
    queryFn: () =>
      fetchAndValidate(
        endpoints.zonasVerdes,
        zonasVerdesFeatureCollectionSchema,
      ),
    // 48.348 polígonos (~23MB): se difiere hasta que el usuario active la
    // capa (toggle apagado por defecto), no se descarga desde el primer
    // render de /mapa.
    enabled,
  });
}

export function useZonasSiembraGeojson() {
  return useQuery({
    queryKey: ["zonas-siembra-geojson"],
    queryFn: () =>
      fetchAndValidate(
        endpoints.zonasSiembraGeojson,
        zonasPriorizadasSiembraFeatureCollectionSchema,
      ),
  });
}

/** Fase E2 — detalle real (área, especie, ficha botánica) de una zona de
 * siembra específica, cargado al hacer click sobre ella en el mapa.
 * `idPoligono: null` desactiva la query (panel cerrado). */
export function useZonaSiembraDetalle(idPoligono: number | null) {
  return useQuery({
    queryKey: ["zona-siembra-detalle", idPoligono],
    queryFn: () =>
      fetchAndValidate(zonaSiembraDetalleUrl(idPoligono as number), zonaSiembraDetalleSchema),
    enabled: idPoligono !== null,
  });
}

export function useEstacionesPM25() {
  return useQuery({
    queryKey: ["pm25-estaciones"],
    queryFn: () =>
      fetchAndValidate(endpoints.pm25Estaciones, z.array(estacionPM25Schema)),
    // Alimenta la animación de partículas: refresca cada 5 min en vez de
    // quedarse con datos indefinidamente obsoletos, sin machacar el backend.
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useRankingComunas(pesos: PesosAhp) {
  return useQuery({
    // Los pesos son parte de la queryKey: cada combinación se refetchea y
    // cachea por separado (el comparador de escenarios mueve sliders en vivo).
    queryKey: ["ranking-comunas", pesos.pesoPm25, pesos.pesoDeficit, pesos.pesoArea],
    queryFn: () =>
      fetchAndValidate(rankingComunasUrl(pesos), z.array(rankingComunaItemSchema)),
  });
}

export function useArbolesResumenComuna() {
  return useQuery({
    queryKey: ["arboles-resumen-comuna"],
    queryFn: () =>
      fetchAndValidate(
        endpoints.arbolesResumenComuna,
        z.array(resumenArbolesComunaSchema),
      ),
    // Agregado liviano (comuna, top especies, % estado): a diferencia de
    // zonas-verdes, se puede cargar siempre para nutrir el dashboard sin
    // esperar a que el usuario active ninguna capa del mapa.
  });
}

export function useArbolesClusters(enabled: boolean, cellSizeDeg?: number) {
  return useQuery({
    queryKey: ["arboles-clusters", cellSizeDeg ?? "default"],
    queryFn: () =>
      fetchAndValidate(arbolesClustersUrl(cellSizeDeg), z.array(clusterArbolesSchema)),
    // Capa de árboles apagada por defecto (igual que zonas-verdes); solo se
    // pide cuando el usuario la activa, y solo en modo clustered (liviano:
    // el número de celdas depende del área, no de los 339.724 árboles).
    enabled,
  });
}

export function useArbolesPuntos(enabled: boolean, bbox: Bbox | null, limit?: number) {
  return useQuery({
    // `limit` en la queryKey: "Respiro Urbano" (limit acotado al cap de
    // instancias 3D) y la capa clustered de zoom cercano (sin limit, tope
    // por defecto del backend) piden el mismo bbox con distinto `limit` y
    // deben cachearse por separado, no compartir resultado.
    queryKey: ["arboles-puntos", bbox?.minLon, bbox?.minLat, bbox?.maxLon, bbox?.maxLat, limit ?? "default"],
    queryFn: () =>
      fetchAndValidate(arbolesPuntosUrl(bbox as Bbox, limit), puntosArbolesResponseSchema),
    // Solo se activa a zoom cercano (nivel comuna/barrio, ver MapCanvas) y
    // solo con un bbox real del viewport actual: nunca pide puntos crudos
    // sin acotar por área.
    enabled: enabled && bbox !== null,
  });
}

export function useSaludResumenComuna() {
  return useQuery({
    queryKey: ["salud-resumen-comuna"],
    queryFn: () =>
      fetchAndValidate(
        endpoints.saludResumenComuna,
        resumenSaludRespiratoriaResponseSchema,
      ),
    // Agregado liviano (por comuna, ya resumido en el backend): se puede
    // cargar siempre, igual que arboles-resumen-comuna.
  });
}

export function usePoblacionComuna() {
  return useQuery({
    queryKey: ["poblacion-comuna"],
    queryFn: () =>
      fetchAndValidate(endpoints.poblacionComuna, z.array(poblacionComunaSchema)),
    // Agregado liviano (21 filas, ya resumido en el backend): se puede
    // cargar siempre, igual que arboles-resumen-comuna y salud-resumen-comuna.
  });
}

export function useAuditoriaEstaciones() {
  return useQuery({
    queryKey: ["auditoria-estaciones"],
    queryFn: () =>
      fetchAndValidate(
        endpoints.auditoriaEstaciones,
        z.array(estacionAuditoriaSchema),
      ),
  });
}
