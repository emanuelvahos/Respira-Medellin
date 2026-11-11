"use client";

import { Suspense, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapConfigPanel } from "@/components/map/MapConfigPanel";
import { ComunaDetailPanel } from "@/components/map/ComunaDetailPanel";
import { ZonaSiembraDetailPanel } from "@/components/map/ZonaSiembraDetailPanel";
import { ComunaKeyboardSelector } from "@/components/map/ComunaKeyboardSelector";
import { AddressSearch } from "@/components/map/AddressSearch";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { useComunas } from "@/lib/api/queries";
import { useMapStore } from "@/store/mapStore";
import { normalizeComunaName } from "@/lib/map/matchComuna";

// El mapa depende de WebGL/`window` (Mapbox GL + deck.gl): no puede
// renderizarse en el servidor.
const MapCanvas = dynamic(
  () => import("@/components/map/MapCanvas").then((mod) => mod.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-border bg-muted">
        <p className="text-sm text-muted-foreground">Cargando mapa…</p>
      </div>
    ),
  },
);

function MapaInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const comunasQuery = useComunas();
  const { selectedComuna, setSelectedComuna } = useMapStore();
  const inicializadoDesdeUrl = useRef(false);

  // Vista compartible: si la URL trae `?comuna=`, dispara el mismo flyTo que
  // ocurre al hacer click manualmente — pero solo una vez, y solo cuando el
  // GeoJSON de comunas ya cargó (si no, no hay geometría para calcular el
  // centroide del flyTo, ver MapCanvas).
  useEffect(() => {
    if (inicializadoDesdeUrl.current || !comunasQuery.isSuccess) return;
    inicializadoDesdeUrl.current = true;

    const comunaParam = searchParams.get("comuna");
    if (comunaParam) {
      const normalizado = normalizeComunaName(comunaParam);
      const existe = comunasQuery.data.features.some(
        (f) => normalizeComunaName(f.properties.nombre) === normalizado,
      );
      if (existe) setSelectedComuna(normalizado);
    }
  }, [comunasQuery.isSuccess, comunasQuery.data, searchParams, setSelectedComuna]);

  // Mantiene la URL sincronizada con la comuna seleccionada (por click,
  // teclado, o la inicialización de arriba) para que "Copiar link" siempre
  // refleje el estado real en pantalla.
  useEffect(() => {
    if (!inicializadoDesdeUrl.current) return;
    const params = new URLSearchParams(searchParams.toString());
    if (selectedComuna) params.set("comuna", selectedComuna);
    else params.delete("comuna");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe re-ejecutarse cuando cambia la comuna seleccionada.
  }, [selectedComuna]);

  return (
    <div className="relative h-[calc(100dvh-4rem)] w-full overflow-hidden">
      <MapCanvas />

      {/* Sistema de layout de 4 zonas fijas, ninguna se superpone con otra
          sin importar cuántos controles estén activos a la vez (ver
          "Rediseño de paneles flotantes" en docs/ESTADO_PROYECTO.md):
          1. Barra superior centrada: buscador de dirección.
          2. Esquina superior izquierda: panel de configuración colapsable
             (Capas + Leyenda en pestañas, altura tope con scroll interno).
          3. Esquina inferior izquierda: controles menores (ir a comuna,
             copiar link).
          4. Columna derecha, altura completa: panel de detalle contextual
             (comuna O zona de siembra, mutuamente excluyentes — ver
             `mapStore.ts`), comparten la misma región. */}
      <AddressSearch />
      <MapConfigPanel />

      <div className="absolute bottom-4 left-4 z-10 flex flex-col items-start gap-2">
        <ComunaKeyboardSelector />
        <CopyLinkButton label="Copiar link de esta vista" />
      </div>

      <ComunaDetailPanel />
      <ZonaSiembraDetailPanel />
    </div>
  );
}

export function MapaClient() {
  // `useSearchParams` (dentro de MapaInner) requiere un límite Suspense
  // explícito: sin él, Next.js falla el build estático de esta ruta.
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100dvh-4rem)] w-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Cargando mapa…</p>
        </div>
      }
    >
      <MapaInner />
    </Suspense>
  );
}
