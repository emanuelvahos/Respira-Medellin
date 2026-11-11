import { z } from "zod";
import { featureCollectionSchema } from "@/types/geojson";

/**
 * Refleja app.models.zona_verde.ZonaVerdeInventarioProperties (backend).
 * Fuente: inventario_zonas_verdes.geojson (GeoMedellín) — ver backend/README.md.
 */
export const zonaVerdeInventarioPropertiesSchema = z
  .object({
    id_poligono: z.number().int(),
    tipologia: z.string(),
    categoria: z.string(),
    subcategoria: z.string(),
    cober_dom: z.string(),
    narb_aprox: z.string(),
    cubierta_verde: z.string(),
    potencial_verde: z.string(),
    observaciones: z.string().nullable().optional(),
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
