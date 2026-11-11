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
    poblacion: z.number().int().nullable().optional(),
    poblacion_anio: z.number().int().nullable().optional(),
    area_km2: z.number().nullable().optional(),
    densidad_hab_km2: z.number().nullable().optional(),
  })
  .passthrough();
export type ComunaProperties = z.infer<typeof comunaPropertiesSchema>;

/** Refleja app.models.poblacion.PoblacionComuna (backend). */
export const poblacionComunaSchema = z.object({
  codigo_comuna: z.string(),
  nombre_comuna: z.string(),
  anio: z.number().int(),
  poblacion: z.number().int(),
  area_km2: z.number().nullable().optional(),
  densidad_hab_km2: z.number().nullable().optional(),
});
export type PoblacionComuna = z.infer<typeof poblacionComunaSchema>;

export const comunasFeatureCollectionSchema = featureCollectionSchema(
  comunaPropertiesSchema,
);
export type ComunasFeatureCollection = z.infer<
  typeof comunasFeatureCollectionSchema
>;
