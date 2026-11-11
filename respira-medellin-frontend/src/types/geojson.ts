import { z } from "zod";
import type {
  Feature,
  FeatureCollection,
  Geometry,
} from "geojson";

export type { Feature, FeatureCollection, Geometry };

const geometrySchema: z.ZodType<Geometry> = z.object({
  type: z.string(),
  coordinates: z.any(),
}) as unknown as z.ZodType<Geometry>;

export function featureSchema<PropsSchema extends z.ZodTypeAny>(
  propertiesSchema: PropsSchema,
) {
  return z.object({
    type: z.literal("Feature"),
    geometry: geometrySchema,
    properties: propertiesSchema,
    id: z.union([z.number(), z.string()]).optional(),
  });
}

export function featureCollectionSchema<PropsSchema extends z.ZodTypeAny>(
  propertiesSchema: PropsSchema,
) {
  return z.object({
    type: z.literal("FeatureCollection"),
    features: z.array(featureSchema(propertiesSchema)),
  });
}
