import { z } from "zod";
import { featureCollectionSchema } from "@/types/geojson";

/** Refleja app.models.comuna.EstacionAuditoria (backend). */
export const estacionAuditoriaSchema = z.object({
  codigo_estacion: z.string(),
  nombre_estacion: z.string(),
  latitud: z.number(),
  longitud: z.number(),
  municipio: z.string(),
  estado: z.string(),
  comuna_por_gis: z.string(),
});
export type EstacionAuditoria = z.infer<typeof estacionAuditoriaSchema>;

/** Refleja app.models.zona_verde.ComunaProperties (backend). Extra fields
 * del shapefile de origen (OBJECTID, Shape_Area, ...) se aceptan y pasan. */
export const comunaPropertiesSchema = z
  .object({
    comuna: z.string(),
    sector: z.number().nullable().optional(),
    nombre: z.string(),
    fecha_sincronizacion: z.number().nullable().optional(),
  })
  .passthrough();
export type ComunaProperties = z.infer<typeof comunaPropertiesSchema>;

export const comunasFeatureCollectionSchema = featureCollectionSchema(
  comunaPropertiesSchema,
);
export type ComunasFeatureCollection = z.infer<
  typeof comunasFeatureCollectionSchema
>;
