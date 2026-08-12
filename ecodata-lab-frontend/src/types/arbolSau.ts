import { z } from "zod";

/** Refleja app.models.arbol_sau.EspecieConteo (backend). */
export const especieConteoSchema = z.object({
  especie: z.string(),
  nombre_comun: z.string().nullable().optional(),
  cantidad: z.number().int(),
});

/** Refleja app.models.arbol_sau.EstadoFitosanitarioResumen (backend). */
export const estadoFitosanitarioResumenSchema = z.object({
  estado: z.string(),
  cantidad: z.number().int(),
  porcentaje: z.number(),
});

/**
 * Refleja app.models.arbol_sau.ResumenArbolesComuna (backend).
 * Fuente: sau_arboles_urbanos.csv (SAU, Alcaldía de Medellín) — ver backend/README.md.
 */
export const resumenArbolesComunaSchema = z.object({
  comuna: z.string(),
  total_arboles: z.number().int(),
  top_especies: z.array(especieConteoSchema),
  distribucion_estado: z.array(estadoFitosanitarioResumenSchema),
});
export type ResumenArbolesComuna = z.infer<typeof resumenArbolesComunaSchema>;

/** Refleja app.models.arbol_sau.ClusterArboles (backend). */
export const clusterArbolesSchema = z.object({
  lon: z.number(),
  lat: z.number(),
  cantidad: z.number().int(),
});
export type ClusterArboles = z.infer<typeof clusterArbolesSchema>;

/** Refleja app.models.arbol_sau.ArbolPunto (backend). */
export const arbolPuntoSchema = z.object({
  objectid: z.number().int(),
  s_especie: z.string().nullable().optional(),
  nombre_comun: z.string().nullable().optional(),
  s_estado_arbol: z.string().nullable().optional(),
  comuna: z.string().nullable().optional(),
  barrio: z.string().nullable().optional(),
  lon: z.number(),
  lat: z.number(),
});
export type ArbolPunto = z.infer<typeof arbolPuntoSchema>;

/** Refleja app.models.arbol_sau.PuntosArbolesResponse (backend). */
export const puntosArbolesResponseSchema = z.object({
  puntos: z.array(arbolPuntoSchema),
  truncado: z.boolean(),
  limite: z.number().int(),
});
export type PuntosArbolesResponse = z.infer<typeof puntosArbolesResponseSchema>;
