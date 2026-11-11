/**
 * `comunas.properties.comuna` es un código numérico ("16"), mientras que
 * `properties.nombre` viene en mayúsculas sin tildes ("BELEN") y el nombre en
 * `resumen_recomendacion_por_comuna`/`pm25` usa mayúscula inicial con tildes
 * ("Belén"). Se normaliza (mayúsculas + sin diacríticos) para poder cruzar
 * ambas fuentes por nombre.
 */
/**
 * Alias de nombres que no coinciden ni siquiera después de normalizar
 * (mayúsculas/tildes), porque las fuentes usan variantes de texto
 * distintas para la misma comuna. Mapea el nombre normalizado del CSV de
 * siembra/PM2.5 al nombre normalizado usado en
 * `limite_catastral_de_comun.geojson` (fuente de verdad para el mapa).
 *
 * - Comuna 11 es oficialmente "Laureles - Estadio"; el CSV de siembra la
 *   trae como "Laureles Estadio" pero el geojson catastral solo usa
 *   "LAURELES".
 * - Comuna 50 es oficialmente "San Sebastián de Palmitas"; salud y
 *   población la traen como "Corregimiento de San Sebastián de Palmitas"
 *   pero el geojson catastral solo usa "PALMITAS".
 *
 * Espejo en Python: backend/app/services/comuna_join.py (misma lista,
 * mismo algoritmo). Si se agrega un alias aquí, agregarlo también allá.
 */
const NAME_ALIASES: Record<string, string> = {
  "LAURELES ESTADIO": "LAURELES",
  "SAN SEBASTIAN DE PALMITAS": "PALMITAS",
};

const PREFIJO_CORREGIMIENTO = "CORREGIMIENTO DE ";

export function normalizeComunaName(nombre: string): string {
  let normalized = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  // Salud y población traen los corregimientos como "Corregimiento de X";
  // el geojson catastral (fuente de verdad para el mapa) solo usa "X".
  if (normalized.startsWith(PREFIJO_CORREGIMIENTO)) {
    normalized = normalized.slice(PREFIJO_CORREGIMIENTO.length);
  }
  return NAME_ALIASES[normalized] ?? normalized;
}
