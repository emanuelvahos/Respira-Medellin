import { z } from "zod";

/** Refleja app.models.ndvi.NdviResumen (backend). */
export const ndviResumenSchema = z.object({
  fuente: z.string(),
  periodo: z.string(),
  fechas_utilizadas: z.number().int(),
  resolucion_m: z.number().int(),
  umbral_vegetacion_densa: z.number(),
  comunas: z.array(
    z.object({
      comuna: z.string(),
      es_urbana: z.boolean(),
      ndvi_mediana: z.number().nullable(),
      ndvi_media: z.number().nullable(),
      pct_vegetacion_densa: z.number().nullable(),
      pct_pixeles_validos: z.number(),
      arboles_vivos: z.number().int(),
      arboles_por_km2: z.number().nullable(),
      arboles_por_1000_hab: z.number().nullable(),
      ratio_mitigadores_pct: z.number().nullable(),
    }),
  ),
  correlaciones: z.array(
    z.object({
      variable: z.string(),
      n_comunas: z.number().int(),
      spearman: z.number().nullable(),
      lectura: z.string(),
    }),
  ),
  advertencias: z.array(z.string()),
});
export type NdviResumen = z.infer<typeof ndviResumenSchema>;
