/**
 * `comunas.properties.comuna` es un código numérico ("16"), mientras que
 * `properties.nombre` viene en mayúsculas sin tildes ("BELEN") y el nombre en
 * `resumen_recomendacion_por_comuna`/`pm25` usa mayúscula inicial con tildes
 * ("Belén"). Se normaliza (mayúsculas + sin diacríticos) para poder cruzar
 * ambas fuentes por nombre.
 */
export function normalizeComunaName(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
}
