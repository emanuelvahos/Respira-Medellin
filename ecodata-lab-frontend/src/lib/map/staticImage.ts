/**
 * Mapbox Static Images API — miniatura de foto aérea real (no el mapa
 * interactivo) para el panel de una zona de siembra marcada como dudosa
 * (Fase D → miniatura satelital). Mismo token público que el mapa
 * interactivo (`NEXT_PUBLIC_MAPBOX_TOKEN`); sin cuenta ni costo adicional.
 *
 * Solo se llama para zonas `posible_no_viable` (ver `MapCanvas.tsx`) — no
 * tiene sentido pedir esto para las ~1.514 zonas consistentes, sería tráfico
 * a Mapbox sin ningún beneficio real (restricción explícita del prompt).
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Zoom 18: suficiente para distinguir cancha/plaza/césped a simple vista en
 * una miniatura pequeña sin quedar tan cerca que un polígono grande (p. ej.
 * una franja de amoblamiento larga y angosta) pierda todo su contexto
 * alrededor. Ver verificación visual en el prompt de esta fase — si 18 no
 * alcanza para casos concretos, subir a 19 caso por caso no rompe nada
 * (parámetro explícito, no hardcodeado en la URL final).
 */
export const ZONA_DUDOSA_THUMBNAIL_ZOOM = 18;
export const ZONA_DUDOSA_THUMBNAIL_WIDTH = 300;
export const ZONA_DUDOSA_THUMBNAIL_HEIGHT = 200;

/**
 * Construye la URL de la Static Images API para un centroide dado. `null`
 * si no hay token configurado (mismo caso ya manejado por el mapa principal
 * desde la Fase 2, ver `MapCanvas.tsx`) — el llamador debe tratar `null`
 * como "no se puede mostrar miniatura", no como un error a propagar.
 */
export function buildZonaDudosaThumbnailUrl(
  longitude: number,
  latitude: number,
  zoom: number = ZONA_DUDOSA_THUMBNAIL_ZOOM,
  width: number = ZONA_DUDOSA_THUMBNAIL_WIDTH,
  height: number = ZONA_DUDOSA_THUMBNAIL_HEIGHT,
): string | null {
  if (!MAPBOX_TOKEN) return null;
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
    `${longitude},${latitude},${zoom}/${width}x${height}@2x` +
    `?access_token=${MAPBOX_TOKEN}`
  );
}
