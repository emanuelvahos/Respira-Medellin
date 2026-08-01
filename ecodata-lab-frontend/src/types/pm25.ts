import { z } from "zod";

/** Refleja app.models.pm25.IntegracionPM25Arboles (backend). */
export const integracionPM25ArbolesSchema = z.object({
  anio: z.number().int(),
  cuatrimestre: z.string(),
  periodo: z.string(),
  comuna: z.string(),
  num_estaciones: z.number().int(),
  codigos_estacion: z.string(),
  estaciones_nombres: z.string(),
  pm25_promedio_ug_m3: z.number(),
  pm25_mediana_ug_m3: z.number(),
  pm25_maximo_ug_m3: z.number(),
  pm25_p95_ug_m3: z.number(),
  horas_validas_total: z.number().int(),
  categoria_oms: z.string(),
  cantidad_arboles_totales: z.number().int(),
  cantidad_arboles_mitigadores_pm25: z.number().int(),
  ratio_mitigadores_pct: z.number(),
  especies_mitigadoras_presentes: z.string(),
});
export type IntegracionPM25Arboles = z.infer<
  typeof integracionPM25ArbolesSchema
>;

/** Refleja app.models.pm25.RelacionComunaAnual (backend). */
export const relacionComunaAnualSchema = z.object({
  anio: z.number().int(),
  comuna: z.string(),
  pm25_promedio_anual: z.number(),
  pm25_maximo_anual: z.number(),
  pm25_p95_anual: z.number(),
  arb_totales: z.number().int(),
  arb_mitigadores: z.number().int(),
  ratio_mitigadores: z.number(),
  rank_pm25: z.number(),
  rank_deficit: z.number(),
  score_vulnerabilidad: z.number(),
  ranking_vulnerabilidad: z.number().int(),
  deficit_pct_mitigadores: z.number(),
  arboles_mitigadores_adicionales: z.number().int(),
  prioridad_intervencion: z.string(),
});
export type RelacionComunaAnual = z.infer<typeof relacionComunaAnualSchema>;
