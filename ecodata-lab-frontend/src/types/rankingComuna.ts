import { z } from "zod";

/** Refleja app.models.siembra.RankingComunaItem (backend). */
export const rankingComunaItemSchema = z.object({
  comuna: z.string(),
  ranking_prioridad: z.number().int(),
  ranking_prioridad_original: z.number().int(),
  score_total: z.number(),
  n_pm25: z.number(),
  n_deficit: z.number(),
  n_area: z.number(),
  pm25_promedio: z.number().nullable(),
  deficit_pct: z.number().nullable(),
  area_total_disponible_ha: z.number(),
  especie_principal: z.string(),
  arboles_a_plantar_total: z.number().int(),
});
export type RankingComunaItem = z.infer<typeof rankingComunaItemSchema>;

/** Pesos AHP (deben sumar 1.0, validado también por el backend). */
export type PesosAhp = {
  pesoPm25: number;
  pesoDeficit: number;
  pesoArea: number;
};

export const PESOS_AHP_ORIGINALES: PesosAhp = {
  pesoPm25: 0.45,
  pesoDeficit: 0.35,
  pesoArea: 0.2,
};
