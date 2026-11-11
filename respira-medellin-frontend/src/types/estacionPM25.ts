import { z } from "zod";

/** Refleja app.models.pm25.EstacionPM25 (backend). Última lectura real por
 * estación SIATA (no agregada por comuna) — ver /api/pm25/estaciones. */
export const estacionPM25Schema = z.object({
  id: z.string(),
  nombre: z.string(),
  lat: z.number(),
  lon: z.number(),
  valor_ug_m3: z.number(),
  fecha_lectura: z.string(),
  comuna_asignada: z.string(),
});
export type EstacionPM25 = z.infer<typeof estacionPM25Schema>;
