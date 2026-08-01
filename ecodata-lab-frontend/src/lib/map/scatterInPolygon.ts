import type { Geometry, Position } from "geojson";

/**
 * El backend no expone coordenadas de árboles individuales (solo conteos
 * agregados por comuna/zona: `cantidad_arboles_totales`, `arboles_cupo_estimado`).
 * Para poder mostrar una "muestra representativa" en el mapa 3D, se dispersan
 * puntos sintéticos dentro de la geometría REAL (polígono de comuna o de zona
 * priorizada) en cantidad proporcional al conteo REAL — la cantidad no se
 * inventa, solo la posición exacta de cada punto dentro del polígono.
 */

function bbox(rings: Position[][]): [number, number, number, number] {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLon, minLat, maxLon, maxLat];
}

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

/** Dispersa `count` puntos dentro de un Polygon/MultiPolygon (rejection sampling). */
export function randomPointsInPolygon(
  geometry: Geometry,
  count: number,
  maxAttempts = count * 40,
): [number, number][] {
  const polygons = ringsOf(geometry);
  if (!polygons.length || count <= 0) return [];

  const allRingsFlat = polygons.flat();
  const [minLon, minLat, maxLon, maxLat] = bbox(allRingsFlat);
  const points: [number, number][] = [];
  let attempts = 0;

  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const candidate: [number, number] = [
      minLon + Math.random() * (maxLon - minLon),
      minLat + Math.random() * (maxLat - minLat),
    ];
    if (polygons.some((rings) => pointInPolygonRings(candidate, rings))) {
      points.push(candidate);
    }
  }
  return points;
}
