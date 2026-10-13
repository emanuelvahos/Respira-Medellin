import { ScatterplotLayer } from "@deck.gl/layers";
import type { PuntosIndicativos } from "@/types/aptitud";
import { tokenToRGBA } from "@/lib/map/colorTokens";

type Punto = PuntosIndicativos["features"][number];

/** Nivel 2 (indicativo): un punto por árbol propuesto en la zona seleccionada. Sin picking. */
export function createPuntosIndicativosLayer({ data }: { data: PuntosIndicativos | undefined }) {
  if (!data || data.features.length === 0) return null;
  return new ScatterplotLayer<Punto>({
    id: "puntos-indicativos",
    data: data.features,
    pickable: false,
    getPosition: (f) => [f.geometry.coordinates[0], f.geometry.coordinates[1]],
    getRadius: 1.4,
    radiusUnits: "meters",
    radiusMinPixels: 4,
    radiusMaxPixels: 14,
    getFillColor: tokenToRGBA("vegetation", 0.95),
    getLineColor: tokenToRGBA("card", 1),
    stroked: true,
    lineWidthUnits: "pixels",
    getLineWidth: 1.5,
  });
}
