"use client";

import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";

// El backend (Render, plan Free) se duerme tras 15 min sin tráfico: un
// request normal responde en ms, pero el primer request tras dormir puede
// tardar ~30-50s. Este aviso solo aparece si una consulta lleva MÁS de este
// umbral en curso — en el caso normal (backend despierto) nunca se ve.
const SLOW_THRESHOLD_MS = 5_000;

/**
 * Aviso global (no por componente) de que la espera es real, no un cuelgue:
 * cubre /mapa y /dashboard por igual sin duplicar el mensaje en cada
 * skeleton individual (KpiCards, ComunasTable, MapCanvas, etc.).
 */
export function ColdStartNotice() {
  const isFetching = useIsFetching() > 0;
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    if (!isFetching) {
      const id = setTimeout(() => setShowNotice(false), 0);
      return () => clearTimeout(id);
    }
    const timer = setTimeout(() => setShowNotice(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(timer);
  }, [isFetching]);

  if (!showNotice) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-sm text-muted-foreground shadow-md backdrop-blur"
    >
      Esto puede tardar unos segundos la primera vez — el servidor se está
      iniciando.
    </div>
  );
}
