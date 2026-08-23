"use client";

import { useComunas } from "@/lib/api/queries";
import { useMapStore } from "@/store/mapStore";
import { normalizeComunaName } from "@/lib/map/matchComuna";

/**
 * Alternativa por teclado/lector de pantalla a la selección de comuna por
 * click sobre el canvas WebGL (deck.gl): el mapa 3D no es operable sin mouse,
 * así que este `<select>` nativo expone la misma acción (`setSelectedComuna`)
 * para que `ComunaDetailPanel` sea alcanzable sin interactuar con el mapa.
 *
 * Sin posición propia — vive dentro de la barra de controles menores de
 * `MapaClient` (esquina inferior izquierda, ver "Rediseño de paneles
 * flotantes" en docs/ESTADO_PROYECTO.md).
 */
export function ComunaKeyboardSelector() {
  const comunasQuery = useComunas();
  const { selectedComuna, setSelectedComuna } = useMapStore();

  const nombres = (comunasQuery.data?.features ?? [])
    .map((f) => f.properties.nombre)
    .sort((a, b) => a.localeCompare(b));

  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-border bg-card/95 p-1.5 text-xs shadow-md backdrop-blur">
      <span className="sr-only">Ir a comuna</span>
      <select
        id="comuna-select"
        aria-label="Ir a comuna"
        className="w-32 rounded-md border border-input bg-background px-1.5 py-1 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40"
        value={selectedComuna ?? ""}
        onChange={(e) => setSelectedComuna(e.target.value || null)}
      >
        <option value="">Ir a comuna…</option>
        {nombres.map((nombre) => (
          <option key={nombre} value={normalizeComunaName(nombre)}>
            {nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
