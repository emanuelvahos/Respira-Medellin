import { FlyToInterpolator } from "@deck.gl/core";
import type { MapViewState } from "@/store/mapStore";

export type FlyToTarget = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

/**
 * Vuelo de cámara compartido por "Respiro Urbano" (selección de comuna) y por
 * `AddressSearch`: actualiza el `viewState` del store con un
 * `FlyToInterpolator` de deck.gl.
 *
 * Es la ÚNICA forma de animar la cámara aquí: llamar a `map.flyTo()`
 * imperativamente sobre la instancia de Mapbox no funciona porque DeckGL
 * controla el `viewState` como componente controlado y lo reimpone en cada
 * render, cancelando la animación nativa casi de inmediato.
 *
 * Devuelve la duración (ms) para que el llamador pueda programar lo que deba
 * ocurrir cuando el vuelo termine (p. ej. revelar árboles 3D).
 */
export function flyTo(
  setViewState: (viewState: MapViewState) => void,
  target: FlyToTarget,
  reducedMotion: boolean,
): number {
  const duration = reducedMotion ? 0 : 1800;
  setViewState({
    ...target,
    transitionDuration: duration,
    transitionInterpolator: new FlyToInterpolator({ speed: 1.6 }),
  } as MapViewState);
  return duration;
}
