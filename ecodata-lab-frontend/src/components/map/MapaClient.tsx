"use client";

import { Suspense, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapLegend } from "@/components/map/MapLegend";
import { MapLayerToggles } from "@/components/map/MapLayerToggles";
import { ComunaDetailPanel } from "@/components/map/ComunaDetailPanel";
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
    if (!comunaParam) return;

    const normalizado = normalizeComunaName(comunaParam);
    const existe = comunasQuery.data.features.some(
      (f) => normalizeComunaName(f.properties.nombre) === normalizado,
    );
    if (existe) setSelectedComuna(normalizado);
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
      <AddressSearch />
      <MapLegend />
      <ComunaKeyboardSelector />
      <MapLayerToggles />
      <ComunaDetailPanel />
      {/* Al lado izquierdo, debajo de "Ir a comuna": el panel de detalle de
          comuna (derecha, `inset-y-0`) cubriría cualquier posición del lado
          derecho en cuanto hay una comuna seleccionada — justo el momento en
          que más sentido tiene copiar el link. */}
      <div className="absolute left-4 top-56 z-10">
        <CopyLinkButton label="Copiar link de esta vista" />
      </div>
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
