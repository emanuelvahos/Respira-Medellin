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

/** Refleja app.models.siembra.FichaEspecie (backend, Fase E2). Ficha
 * botánica real — ver backend/data/fichas_especies.json y backend/README.md
 * sección "Detalle de zona de siembra (Fase E2)" para la fuente exacta. */
export const fichaEspecieSchema = z.object({
  nombre_comun: z.string(),
  familia: z.string(),
  origen: z.string(),
  distribucion_geografica: z.string(),
  altura_max_m: z.number(),
  amplitud_copa: z.string(),
  copa_min_m: z.number(),
  margen_seguridad_m: z.number(),
  densidad_follaje: z.string(),
  tasa_crecimiento: z.string(),
  longevidad: z.string(),
  rango_altitudinal_msnm: z.tuple([z.number(), z.number()]),
  tipo_suelo: z.array(z.string()),
  requerimiento_luminosidad: z.string(),
  pm25_eficiencia: z.string(),
  funcion: z.array(z.string()),
  usos_espacio_publico: z.array(z.string()),
  estado_conservacion: z.string(),
  fuentes: z.string(),
});
export type FichaEspecie = z.infer<typeof fichaEspecieSchema>;

/** Refleja app.models.siembra.EspecieDiversificacion (backend, Fase E3).
 * Propuesta EXPLORATORIA de este proyecto, NUNCA la recomendación oficial
 * del pipeline — ver `diversificacion_disponible` en `ZonaSiembraDetalle`. */
export const especieDiversificacionSchema = z.object({
  especie: z.string(),
  individuos_estimado: z.number().int(),
  proporcion: z.number(),
});
export type EspecieDiversificacion = z.infer<typeof especieDiversificacionSchema>;

/** Refleja app.models.siembra.ZonaSiembraDetalle (backend, Fase E2 + E3). */
export const zonaSiembraDetalleSchema = z.object({
  id_poligono: z.number().int(),
  comuna: z.string(),
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
  /** `null` si la especie no tiene ficha en `fichas_especies.json` — el
   * panel debe comunicarlo honestamente, nunca inventar contenido. */
  ficha_especie: fichaEspecieSchema.nullable(),
  /** Fase E3 — `true` solo si hay 2+ especies compatibles reales Y el cupo
   * de la zona es >= 10 individuos (ver backend/README.md). */
  diversificacion_disponible: z.boolean(),
  propuesta_diversificacion: z.array(especieDiversificacionSchema).nullable(),
  /** Cuántas de las 5 especies documentadas son compatibles con esta
   * categoría de zona (rango altitudinal + categoria) — `null` si el
   * archivo de análisis de diversificación no existe en el entorno.
   * Distingue "solo 1 especie compatible" de "cupo insuficiente" cuando
   * `diversificacion_disponible` es `false`. */
  n_especies_compatibles: z.number().int().nullable(),
});
export type ZonaSiembraDetalle = z.infer<typeof zonaSiembraDetalleSchema>;

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
    /**
     * Fase D — auditoría de viabilidad (backend/scripts/auditar_viabilidad_siembra.py),
     * inyectada por id_poligono al servir el endpoint, no viene del archivo
     * original en disco. `null`/`undefined` si la auditoría no se ha corrido
     * en el entorno que sirve la API. Ver backend/README.md.
     */
    viabilidad_auditada: z
      .enum(["consistente", "posible_no_viable", "sin_solape_con_inventario_real"])
      .nullable()
      .optional(),
    /** Motivo legible solo cuando viabilidad_auditada === "posible_no_viable". */
    viabilidad_motivo: z.string().nullable().optional(),
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
