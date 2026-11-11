import { z } from "zod";

/** Refleja app.services.maduracion.Escenario (backend). */
export const escenarioMaduracionSchema = z.enum(["optimista", "esperado", "conservador"]);
export type EscenarioMaduracion = z.infer<typeof escenarioMaduracionSchema>;

export const ESCENARIOS_MADURACION: EscenarioMaduracion[] = ["optimista", "esperado", "conservador"];

export const ESCENARIO_LABELS: Record<EscenarioMaduracion, string> = {
  optimista: "Optimista",
  esperado: "Esperado",
  conservador: "Conservador",
};

/** Refleja app.models.siembra.FactorMaduracionEspecie (backend). */
export const factorMaduracionEspecieSchema = z.object({
  especie: z.string(),
  categoria_crecimiento: z.enum(["Rápida", "Media", "Lenta"]),
  anio_maduracion_escenario: z.number().int(),
  factor: z.number(),
  fuente_categoria: z.string(),
  fuente_anios: z.string(),
});

/** Refleja app.models.siembra.ProyeccionComuna (backend). */
export const proyeccionComunaSchema = z.object({
  comuna: z.string(),
  factor_promedio: z.number(),
  arboles_cupo_estimado_total: z.number().int(),
});

/** Refleja app.models.siembra.ProyeccionMaduracion (backend) — respuesta de
 * `/api/siembra/proyeccion`. Nunca contiene un valor de PM2.5 en µg/kg: solo
 * un factor 0-1 que multiplica los datos reales ya existentes. */
export const proyeccionMaduracionSchema = z.object({
  anio: z.number().int(),
  escenario: escenarioMaduracionSchema,
  factor_promedio_ciudad: z.number(),
  arboles_cupo_estimado_total: z.number().int(),
  n_zonas: z.number().int(),
  n_zonas_con_diversificacion: z.number().int(),
  por_especie: z.array(factorMaduracionEspecieSchema),
  por_comuna: z.array(proyeccionComunaSchema),
  anios_maduracion_por_escenario: z.record(z.string(), z.record(z.string(), z.number().int())),
  caveats: z.array(z.string()),
  formula: z.string(),
});
export type ProyeccionMaduracion = z.infer<typeof proyeccionMaduracionSchema>;
