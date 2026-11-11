const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export type GeocodingFeature = {
  id: string;
  placeName: string;
  /** [longitud, latitud], como lo devuelve Mapbox. */
  center: [number, number];
};

type MapboxGeocodingResponse = {
  features?: {
    id: string;
    place_name: string;
    center: [number, number];
  }[];
};

/**
 * Consulta Mapbox Geocoding directo desde el navegador (mismo token público
 * ya usado por `MapCanvas`, sin necesidad de proxear por el backend propio).
 * Acota los resultados al `bbox` de Medellín (`MEDELLIN_MAX_BOUNDS`) para no
 * traer aciertos de otras ciudades con nombres de calle coincidentes.
 */
export async function searchMedellinPlaces(
  query: string,
  bbox: readonly [readonly [number, number], readonly [number, number]],
  signal?: AbortSignal,
): Promise<GeocodingFeature[]> {
  if (!MAPBOX_TOKEN || !query.trim()) return [];

  const [[minLon, minLat], [maxLon, maxLat]] = bbox;
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    bbox: `${minLon},${minLat},${maxLon},${maxLat}`,
    language: "es",
    country: "co",
    limit: "5",
  });

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;

  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Mapbox Geocoding respondió ${res.status}`);
  }

  const data = (await res.json()) as MapboxGeocodingResponse;
  return (data.features ?? []).map((f) => ({
    id: f.id,
    placeName: f.place_name,
    center: f.center,
  }));
}
