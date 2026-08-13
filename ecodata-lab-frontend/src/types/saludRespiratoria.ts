import { z } from "zod";

/** Refleja app.models.salud_respiratoria.DiagnosticoConteo (backend). */
export const diagnosticoConteoSchema = z.object({
  codigo: z.string(),
  nombre: z.string(),
  cantidad: z.number().int(),
});

/** Refleja app.models.salud_respiratoria.ResumenSaludComuna (backend). */
export const resumenSaludComunaSchema = z.object({
  comuna: z.string(),
  total_diagnosticos_respiratorios: z.number().int(),
  por_anio: z.record(z.string(), z.number().int()),
  top_diagnosticos: z.array(diagnosticoConteoSchema),
});
export type ResumenSaludComuna = z.infer<typeof resumenSaludComunaSchema>;

/** Refleja app.models.salud_respiratoria.FuenteSaludRespiratoria (backend). */
export const fuenteSaludRespiratoriaSchema = z.object({
  nombre: z.string(),
  url: z.string(),
  dataset_id: z.string(),
  fecha_consulta: z.string(),
  rango_datos_fuente: z.string(),
  filtro_aplicado: z.string(),
});

/**
 * Refleja app.models.salud_respiratoria.ResumenSaludRespiratoriaResponse (backend).
 * `metodologia` no es opcional a propósito: el caveat de sesgo (red pública
 * Metrosalud, no morbilidad total de la ciudad) debe viajar con el dato.
 */
export const resumenSaludRespiratoriaResponseSchema = z.object({
  fuente: fuenteSaludRespiratoriaSchema,
  metodologia: z.string(),
  comunas: z.array(resumenSaludComunaSchema),
});
export type ResumenSaludRespiratoriaResponse = z.infer<
  typeof resumenSaludRespiratoriaResponseSchema
>;
