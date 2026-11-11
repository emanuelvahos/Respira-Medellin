"use client";

import { useEffect } from "react";
import { gsap, ScrollTrigger, useRegisterScrollTrigger } from "@/hooks/useGsapScrollTrigger";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMapStore, type MapViewState } from "@/store/mapStore";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpViewState(a: MapViewState, b: MapViewState, t: number): MapViewState {
  return {
    longitude: lerp(a.longitude, b.longitude, t),
    latitude: lerp(a.latitude, b.latitude, t),
    zoom: lerp(a.zoom, b.zoom, t),
    pitch: lerp(a.pitch, b.pitch, t),
    bearing: lerp(a.bearing, b.bearing, t),
  };
}

/**
 * Sincroniza el `viewState` del mapa de fondo (mismo `mapStore`/`MapCanvas`
 * de Fase 2, no un mapa nuevo) con el progreso de scroll de la landing,
 * usando GSAP ScrollTrigger con `scrub`. El scroll total de la página se
 * mapea linealmente sobre la lista de `keyframes` (uno por sección).
 *
 * Con `prefers-reduced-motion`: no se crea el scrub — la cámara queda fija
 * en un encuadre intermedio, sin vuelos automáticos.
 */
export function ScrollMapSync({ keyframes }: { keyframes: MapViewState[] }) {
  useRegisterScrollTrigger();
  const setViewState = useMapStore((s) => s.setViewState);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (keyframes.length < 2) return;

    if (reducedMotion) {
      setViewState(keyframes[Math.floor(keyframes.length / 2)]);
      return;
    }

    // Sin `trigger`: ScrollTrigger usa `window` como scroller y `start`/`end`
    // como posiciones de scroll absolutas ("max" = todo el documento). Usar
    // `document.documentElement` como trigger (como se hacía antes) mide mal
    // el rango porque `<html>` tiene `h-full` (Fase 0) — su propio bounding
    // box queda fijo al alto del viewport, no al alto real del documento.
    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      scrub: 0.6,
      onUpdate: (self) => {
        const segments = keyframes.length - 1;
        const scaled = self.progress * segments;
        const index = Math.min(segments - 1, Math.floor(scaled));
        const localT = scaled - index;
        setViewState(lerpViewState(keyframes[index], keyframes[index + 1], localT));
      },
    });

    return () => trigger.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyframes se calculan una vez por render de la página (dependen de datos ya estables cuando se monta este componente).
  }, [reducedMotion, setViewState]);

  useEffect(() => {
    return () => {
      gsap.killTweensOf(window);
    };
  }, []);

  return null;
}
