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
 */
const NAME_ALIASES: Record<string, string> = {
  "LAURELES ESTADIO": "LAURELES",
};

export function normalizeComunaName(nombre: string): string {
  const normalized = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  return NAME_ALIASES[normalized] ?? normalized;
}
