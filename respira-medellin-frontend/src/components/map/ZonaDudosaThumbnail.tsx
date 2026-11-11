"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageBrokenIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Miniatura de foto aérea real (Mapbox Static Images API) para el panel de
 * una zona de siembra marcada como `posible_no_viable` — ver
 * `src/lib/map/staticImage.ts` para la construcción de la URL y por qué
 * solo se usa para zonas dudosas.
 *
 * Carga asíncrona con su propio estado (`loading` -> `loaded`/`error`): no
 * bloquea el resto del panel, que ya se ve completo con el motivo de la
 * alerta antes de que la imagen termine de cargar.
 */
export function ZonaDudosaThumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  if (!src) {
    // Sin NEXT_PUBLIC_MAPBOX_TOKEN configurado: mismo caso ya manejado por
    // el mapa principal (Fase 2) — falla con gracia, no rompe el panel.
    return (
      <div className="flex h-[100px] w-full items-center justify-center rounded-md border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
        Miniatura no disponible (falta configurar el token de Mapbox)
      </div>
    );
  }

  return (
    <div className="relative h-[100px] w-full overflow-hidden rounded-md border border-border bg-muted">
      {status !== "loaded" && (
        <div
          className={`absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground ${
            status === "loading" ? "animate-pulse bg-muted" : "bg-muted"
          }`}
        >
          {status === "loading" ? (
            "Cargando imagen satelital…"
          ) : (
            <span className="flex flex-col items-center gap-1 px-2 text-center">
              <ImageBrokenIcon size={18} aria-hidden="true" />
              No se pudo cargar la imagen satelital
            </span>
          )}
        </div>
      )}
      {status !== "error" && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="300px"
          unoptimized
          className={`object-cover transition-opacity ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
        />
      )}
    </div>
  );
}
