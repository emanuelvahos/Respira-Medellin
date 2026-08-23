"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

/**
 * Renderiza `children` directamente en `document.body` en vez de dentro del
 * árbol del mapa. Usado por los paneles de detalle que se deslizan desde la
 * derecha (`ComunaDetailPanel`, `ZonaSiembraDetailPanel`).
 *
 * Por qué: con estos paneles como hijos normales del contenedor del mapa
 * (`position:absolute` hermanos de `MapConfigPanel`), se observó un bug real
 * y reproducible en Chrome — al abrir un panel (su `transition-transform`
 * pasa de `translate-x-full` a `translate-x-0`, y su contenido crece con
 * datos reales cargados), sus hermanos absolutos (`MapConfigPanel`, la
 * barra de controles menores) quedaban con un layout incorrecto y
 * desaparecían de la pantalla — confirmado que NO era `transform`, `translate`,
 * `scale`, `filter`, `content-visibility` ni ningún otro estilo (forzarlos
 * por JS no cambiaba nada), así que es un problema de layout/paint del
 * navegador ligado a tener muchos hermanos `position:absolute` bajo un
 * contenedor `position:relative; overflow:hidden` cuando uno de ellos anima
 * su tamaño/transform. Sacar estos paneles del árbol de layout del mapa por
 * completo (portal a `body`, `position:fixed` en vez de `absolute`) elimina
 * la interacción de raíz, en vez de parchear el síntoma.
 *
 * `mounted` evita el mismatch de hidratación: `document` no existe en el
 * render de servidor.
 */
export function MapPanelPortal({ children }: { children: React.ReactNode }) {
  // Patrón recomendado por React para "¿ya estamos en el cliente?" sin el
  // anti-patrón de `setState` dentro de un efecto (`useSyncExternalStore`
  // con snapshot de servidor `false` y de cliente `true` — nunca cambia
  // después del montaje, así que no hace falta un store externo real).
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(children, document.body);
}
