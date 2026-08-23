import type { Geometry, Position } from "geojson";

/**
 * Point-in-polygon (ray casting) sobre geometría GeoJSON real (Polygon o
 * MultiPolygon, huecos incluidos) — usado donde hace falta probar si una
 * coordenada real cae dentro del polígono real de una comuna/zona (ej.
 * contar estaciones de monitoreo PM2.5 dentro de una comuna, ver
 * `isPointInPolygon` abajo).
 */

function pointInRing(point: [number, number], ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygonRings(point: [number, number], rings: Position[][]): boolean {
  if (!rings.length) return false;
  if (!pointInRing(point, rings[0])) return false;
  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(point, rings[i])) return false; // dentro de un hueco
  }
  return true;
}

function ringsOf(geometry: Geometry): Position[][][] {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

/** `true` si `point` ([lon, lat]) cae dentro de un Polygon/MultiPolygon real
 * (huecos incluidos). */
export function isPointInPolygon(point: [number, number], geometry: Geometry): boolean {
  const polygons = ringsOf(geometry);
  return polygons.some((rings) => pointInPolygonRings(point, rings));
}
