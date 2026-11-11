import { z } from "zod";

/** Refleja app.models.mortalidad_respiratoria.MortalidadRespiratoriaComuna (backend). */
export const mortalidadRespiratoriaComunaSchema = z.object({
  comuna: z.string(),
  muertes_2017_2021: z.number().int(),
  tasa_x100mil: z.number(),
});
export type MortalidadRespiratoriaComuna = z.infer<typeof mortalidadRespiratoriaComunaSchema>;

/**
 * Refleja app.models.mortalidad_respiratoria.MortalidadRespiratoriaResponse (backend).
 * `metodologia` no es opcional a propósito: viaja siempre con el dato.
 */
export const mortalidadRespiratoriaResponseSchema = z.object({
  fuente: z.string(),
  licencia: z.string(),
  metodologia: z.string(),
  comunas: z.array(mortalidadRespiratoriaComunaSchema),
});
export type MortalidadRespiratoriaResponse = z.infer<typeof mortalidadRespiratoriaResponseSchema>;
