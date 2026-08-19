import { z } from "zod";
import { featureCollectionSchema } from "@/types/geojson";

/** Refleja app.models.siembra.RecomendacionSiembraZona (backend). */
export const recomendacionSiembraZonaSchema = z.object({
  id_poligono: z.number().int(),
  comuna: z.string(),
  ranking_prioridad_comuna: z.number().int(),
  score_multicriteria: z.number(),
  tipologia: z.string(),
  categoria: z.string(),
  cobertura_actual: z.string(),
  area_m2: z.number(),
  area_ha: z.number(),
  especie_recomendada: z.string(),
  nombre_comun_especie: z.string(),
  arboles_cupo_estimado: z.number().int(),
  separacion_minima_m: z.number(),
  eficiencia_pm25: z.string(),
  especies_alternativas: z.string(),
  fuentes_botanicas: z.string(),
});
export type RecomendacionSiembraZona = z.infer<
  typeof recomendacionSiembraZonaSchema
>;

/** Refleja app.models.siembra.ResumenRecomendacionComuna (backend). */
export const resumenRecomendacionComunaSchema = z.object({
  comuna: z.string(),
  ranking_prioridad: z.number().int(),
  score_multicriteria: z.number(),
  n_zonas_disponibles: z.number().int(),
  area_total_disponible_ha: z.number(),
  arboles_a_plantar_total: z.number().int(),
  especie_principal: z.string(),
  cupo_especie_principal: z.number().int(),
  pm25_promedio: z.number().nullable(),
  deficit_pct: z.number().nullable(),
  ratio_mitigadores: z.number().nullable(),
  /**
   * "pipeline_original" (11 comunas con zona) | "recalculo_zonas_verdes_reales"
   * (4 comunas sin zona, PM2.5 medido) | "interpolado_idw" (3 comunas sin
   * estación SIATA real dentro de su polígono, PM2.5 ESTIMADO por
   * interpolación espacial — Popular, Manrique, Doce de Octubre) |
   * "historico_no_vigente" (Altavista: PM2.5 real pero de una estación hoy
   * inactiva — MED-ALTA2/Corantioquia vía SISAIRE-IDEAM).
   */
  fuente_score: z.enum([
    "pipeline_original",
    "recalculo_zonas_verdes_reales",
    "interpolado_idw",
    "historico_no_vigente",
  ]),
  /** false: comuna con score AHP calculado pero SIN zona de siembra viable identificada. */
  tiene_zona_siembra: z.boolean(),
  /** "medido": lectura real de estación SIATA. "interpolado": estimado IDW, no medido. "historico": real pero de estación ya inactiva. "sin_dato": ninguno. */
  pm25_tipo_dato: z.enum(["medido", "interpolado", "sin_dato", "historico"]),
  /** Solo aplica cuando pm25_tipo_dato === "interpolado". */
  pm25_confianza: z.enum(["media", "baja"]).nullable(),
  /** Distancia real (km) a la estación SIATA real más cercana usada en el IDW. Solo aplica si pm25_tipo_dato === "interpolado". */
  pm25_distancia_estacion_mas_cercana_km: z.number().nullable(),
  /** Fecha (YYYY-MM-DD) del último dato real disponible. Solo aplica cuando pm25_tipo_dato === "historico" (Altavista). */
  pm25_fecha_ultimo_dato: z.string().nullable().optional(),
});
export type ResumenRecomendacionComuna = z.infer<
  typeof resumenRecomendacionComunaSchema
>;

/** Refleja app.models.zona_verde.ZonaPriorizadaSiembraProperties (backend). */
export const zonaPriorizadaSiembraPropertiesSchema = z
  .object({
    id_poligono: z.number().int(),
    categoria: z.string(),
    cober_dom: z.string(),
    comuna: z.string(),
    ranking_prioridad_comuna: z.number().int(),
    score_multicriteria: z.number(),
    especie_recomendada: z.string(),
    nombre_comun_especie: z.string(),
    arboles_cupo_estimado: z.number().int(),
    eficiencia_pm25: z.string(),
  })
  .passthrough();
export type ZonaPriorizadaSiembraProperties = z.infer<
  typeof zonaPriorizadaSiembraPropertiesSchema
>;

export const zonasPriorizadasSiembraFeatureCollectionSchema =
  featureCollectionSchema(zonaPriorizadaSiembraPropertiesSchema);
export type ZonasPriorizadasSiembraFeatureCollection = z.infer<
  typeof zonasPriorizadasSiembraFeatureCollectionSchema
>;
