import { z } from "zod";

const intNullable = z.number().int().nullable().optional();
const numNullable = z.number().nullable().optional();

/** Refleja app.models.ahp_v2.AhpV2Comuna (backend): AHP v1 vs v2 (SAU actual) por comuna. */
export const ahpV2ComunaSchema = z.object({
  comuna: z.string(),
  grupo: z.string(),
  pm25_promedio: numNullable,
  pm25_tipo_dato: z.string(),
  pm25_confianza: z.string(),
  tiene_zona_siembra: z.boolean(),
  area_total_disponible_ha: z.number(),
  n_zonas_disponibles: z.number().int(),
  arboles_a_plantar_total: z.number().int(),
  poblacion: intNullable,
  arboles_vivos_sau: intNullable,
  mitigadores_sau: intNullable,
  arboles_por_1000_hab: numNullable,
  ratio_mitigadores_v1_pct: numNullable,
  deficit_v1_pct: numNullable,
  ratio_mitigadores_v2_pct: numNullable,
  deficit_v2_pct: numNullable,
  score_v1: numNullable,
  rank_v1_original: intNullable,
  rank_v1_11: intNullable,
  score_v2_11: numNullable,
  rank_v2_11: intNullable,
  cambio_posicion_11: intNullable,
  n_pm25_15: numNullable,
  n_deficit_15: numNullable,
  n_area_15: numNullable,
  score_v2_15: numNullable,
  rank_v2_15: intNullable,
});
export type AhpV2Comuna = z.infer<typeof ahpV2ComunaSchema>;

/** Refleja app.models.ahp_v2.AhpV2Resumen (backend). */
export const ahpV2ResumenSchema = z.object({
  especies_mitigadoras: z.array(z.string()),
  pesos: z.object({ pm25: z.number(), deficit: z.number(), area: z.number() }),
  benchmark_deficit_pct: z.number(),
  arboles_v1_total_11_comunas: z.number().int(),
  arboles_vivos_sau_total_11_comunas: z.number().int(),
  arboles_vivos_sau_total_medellin: z.number().int(),
  spearman_rank_v1_vs_v2_11: z.number(),
  top5_v1: z.array(z.string()),
  top5_v2: z.array(z.string()),
  top5_coinciden: z.number().int(),
  rango_deficit_v2_pct: z.array(z.number()),
  advertencia: z.string(),
});
export type AhpV2Resumen = z.infer<typeof ahpV2ResumenSchema>;
