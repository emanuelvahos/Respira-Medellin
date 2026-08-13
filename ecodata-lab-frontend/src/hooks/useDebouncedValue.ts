"use client";

import { useEffect, useState } from "react";

/** Devuelve `value` con un retraso de `delayMs`, reiniciando el temporizador
 * en cada cambio — evita disparar una consulta de red por cada tecla. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
