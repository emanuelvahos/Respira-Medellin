import { GeoJsonLayer } from "@deck.gl/layers";
import type { Geometry } from "geojson";
import type { ZonaVerdeInventarioProperties } from "@/types/zonaVerde";
import { tokenToRGBA } from "@/lib/map/colorTokens";

/**
 * `inventario_zonas_verdes.geojson` no existe todavía en el repo de datos
 * (ruta rota heredada del script original) y el endpoint responde 503. Esta
 * capa debe degradarse con gracia: si no hay datos (isError/isPending/data
 * ausente), devuelve `null` en vez de lanzar, para no tumbar el resto del mapa.
 */
export function createZonasVerdesLayer({
  data,
  isError,
}: {
  data: GeoJSON.FeatureCollection<Geometry, ZonaVerdeInventarioProperties> | undefined;
  isError: boolean;
}) {
  if (isError || !data) return null;

  return new GeoJsonLayer<ZonaVerdeInventarioProperties>({
    id: "zonas-verdes",
    data,
    pickable: false,
    stroked: true,
    filled: true,
    extruded: false,
    getFillColor: () => tokenToRGBA("vegetation-muted", 0.5),
    getLineColor: () => tokenToRGBA("vegetation", 0.4),
    lineWidthMinPixels: 1,
  });
}
