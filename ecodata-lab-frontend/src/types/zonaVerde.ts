import { z } from "zod";
import { featureCollectionSchema } from "@/types/geojson";

/**
 * Refleja app.models.zona_verde.ZonaVerdeInventarioProperties (backend).
 *
 * Placeholder: el dataset fuente (inventario_zonas_verdes.geojson) no existe
 * todavía en el repo de datos. El endpoint /api/zonas-verdes responde 503
 * mientras tanto — ver backend/README.md, sección "Dataset pendiente".
 */
export const zonaVerdeInventarioPropertiesSchema = z
  .object({
    id_poligono: z.number().int(),
    tipo_cobertura: z.string(),
    tipologia: z.string(),
    comuna: z.string(),
  })
  .passthrough();
export type ZonaVerdeInventarioProperties = z.infer<
  typeof zonaVerdeInventarioPropertiesSchema
>;

export const zonasVerdesFeatureCollectionSchema = featureCollectionSchema(
  zonaVerdeInventarioPropertiesSchema,
);
export type ZonasVerdesFeatureCollection = z.infer<
  typeof zonasVerdesFeatureCollectionSchema
>;
