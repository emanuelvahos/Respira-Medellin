import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { endpoints, rankingComunasUrl } from "@/lib/api/endpoints";
import { comunasFeatureCollectionSchema, estacionAuditoriaSchema } from "@/types/comuna";
import { estacionPM25Schema } from "@/types/estacionPM25";
import { integracionPM25ArbolesSchema } from "@/types/pm25";
import { rankingComunaItemSchema, type PesosAhp } from "@/types/rankingComuna";
import {
  recomendacionSiembraZonaSchema,
  resumenRecomendacionComunaSchema,
  zonasPriorizadasSiembraFeatureCollectionSchema,
} from "@/types/siembra";
import { zonasVerdesFeatureCollectionSchema } from "@/types/zonaVerde";

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
