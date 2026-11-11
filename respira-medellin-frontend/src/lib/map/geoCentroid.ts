import type { Geometry, Position } from "geojson";

/**
 * Centroide aproximado (promedio de vértices, no el centroide geométrico
 * exacto) de un Polygon/MultiPolygon. Suficiente para apuntar la cámara
 * (`flyTo`) al centro visual de una comuna — no se usa para cálculos de área.
 */
export function approximateCentroid(geometry: Geometry): [number, number] | null {
  const coords: Position[] = [];

  function collect(rings: unknown): void {
    if (!Array.isArray(rings)) return;
    if (typeof rings[0] === "number") {
      coords.push(rings as Position);
      return;
    }
    for (const child of rings) collect(child);
  }

  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    collect(geometry.coordinates);
  } else {
    return null;
  }

  if (!coords.length) return null;

  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / coords.length, sumLat / coords.length];
}
