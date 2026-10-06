import { z } from "zod";

const intN = z.number().int().nullable().optional();
const numN = z.number().nullable().optional();

/** Refleja app.models.arbol_sau.ArbolesComunaDetalle (backend). */
export const arbolesComunaDetalleSchema = z.object({
  comuna: z.string(),
  arboles_vivos: z.number().int(),
  porcentaje_de_medellin: z.number(),
  talados: z.number().int(),
  desaparecidos: z.number().int(),
  muertos: z.number().int(),
  mitigadores: z.number().int(),
  ratio_mitigadores_pct: numN,
  poblacion: intN,
  arboles_por_1000_hab: numN,
  area_km2: numN,
  arboles_por_km2: numN,
  top_especies: z.array(
    z.object({ especie: z.string(), nombre_comun: z.string().nullable().optional(), cantidad: z.number().int() }),
  ),
  top_barrios: z.array(z.object({ barrio: z.string(), arboles: z.number().int() })),
  registros_ultimos_3_anios: z.number().int(),
  ranking_v2: intN,
  ranking_v1: intN,
  score_v2: numN,
  pm25_promedio: numN,
  pm25_tipo_dato: z.string().nullable().optional(),
  pm25_confianza: z.string().nullable().optional(),
  tiene_zona_siembra: z.boolean(),
  contribucion: z
    .object({
      pm25: z.number(),
      deficit: z.number(),
      area: z.number(),
      maximo_pm25: z.number(),
      maximo_deficit: z.number(),
      maximo_area: z.number(),
    })
    .nullable()
    .optional(),
  razones: z.array(z.string()),
});
export type ArbolesComunaDetalle = z.infer<typeof arbolesComunaDetalleSchema>;
