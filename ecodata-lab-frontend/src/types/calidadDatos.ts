import { z } from "zod";

/** Refleja app.models.calidad_datos.CalidadDatos (backend). */
export const calidadDatosSchema = z.object({
  fecha_calculo: z.string(),
  resumen: z.string(),
  fuentes: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      proveedor: z.string(),
      usada_en: z.string(),
      fecha_corte: z.string().nullable(),
      antiguedad_dias: z.number().int().nullable(),
      cadencia_recomendada_dias: z.number().int(),
      estado: z.enum(["vigente", "atencion", "desactualizado", "sin_fecha"]),
      confianza: z.enum(["alta", "media", "baja"]),
      registros: z.number().int().nullable(),
      cobertura: z.string(),
      actualizacion: z.string(),
      limitaciones: z.array(z.string()),
    }),
  ),
  chequeos: z.array(z.object({ id: z.string(), descripcion: z.string(), ok: z.boolean(), detalle: z.string() })),
});
export type CalidadDatos = z.infer<typeof calidadDatosSchema>;
