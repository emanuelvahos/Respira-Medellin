import { z } from "zod";

/** Refleja app.models.aptitud (backend, fase J2). */
export const zonaAptitudSchema = z.object({
  id_poligono: z.number().int(),
  aptitud: z.enum(["apta", "apta_con_condiciones", "no_apta"]),
  motivos_no_apta: z.array(z.string()),
  condiciones: z.array(z.string()),
  metricas: z.object({
    pendiente_media_grados: z.number().nullable(),
    pendiente_p90_grados: z.number().nullable(),
    fraccion_amenaza_mov_masa_alta: z.number(),
    fraccion_amenaza_inundacion_alta: z.number(),
    fraccion_amenaza_torrencial_alta: z.number(),
    fraccion_riesgo_no_mitigable: z.number(),
    fraccion_retiro_quebrada: z.number(),
    fraccion_franja_tension: z.number(),
    anden_ancho_m: z.number().nullable(),
    redes_cercanas: z.array(z.string()),
  }),
  razones_especie: z.array(z.string()),
  puntos_indicativos: z.number().int(),
  cupo_estimado_previo: z.number().int().nullable(),
  puntos_publicos: z.boolean(),
  avisos: z.array(z.string()),
  fecha_consulta: z.string(),
});
export type ZonaAptitud = z.infer<typeof zonaAptitudSchema>;

export const puntosIndicativosSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: z.object({ type: z.literal("Point"), coordinates: z.array(z.number()) }),
      properties: z.object({
        id_poligono: z.number().int(),
        n: z.number().int(),
        especie: z.string(),
        nombre_cientifico: z.string(),
      }),
    }),
  ),
});
export type PuntosIndicativos = z.infer<typeof puntosIndicativosSchema>;
