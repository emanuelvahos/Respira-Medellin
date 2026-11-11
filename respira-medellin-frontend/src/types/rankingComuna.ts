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

const TOLERANCIA_SUMA_PESOS = 1e-3;

/**
 * Lee los 3 pesos desde query params de la URL (vista compartible del
 * comparador AHP) — devuelve `null` si faltan, no son números válidos, o no
 * suman ~1.0, para que quien llama pueda hacer fallback a
 * `PESOS_AHP_ORIGINALES` sin propagar un estado inconsistente.
 */
export function pesosFromSearchParams(params: URLSearchParams): PesosAhp | null {
  const pesoPm25 = Number(params.get("peso_pm25"));
  const pesoDeficit = Number(params.get("peso_deficit"));
  const pesoArea = Number(params.get("peso_area"));

  if (![pesoPm25, pesoDeficit, pesoArea].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
    return null;
  }
  if (Math.abs(pesoPm25 + pesoDeficit + pesoArea - 1) > TOLERANCIA_SUMA_PESOS) {
    return null;
  }
  return { pesoPm25, pesoDeficit, pesoArea };
}

/** Serializa los pesos a los mismos nombres de query param que lee `pesosFromSearchParams`. */
export function pesosToSearchParamsEntries(pesos: PesosAhp): [string, string][] {
  return [
    ["peso_pm25", pesos.pesoPm25.toFixed(4)],
    ["peso_deficit", pesos.pesoDeficit.toFixed(4)],
    ["peso_area", pesos.pesoArea.toFixed(4)],
  ];
}
