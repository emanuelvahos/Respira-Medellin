"use client";

import { useComunas } from "@/lib/api/queries";
import { useMapStore } from "@/store/mapStore";
import { normalizeComunaName } from "@/lib/map/matchComuna";

/**
 * Alternativa por teclado/lector de pantalla a la selección de comuna por
 * click sobre el canvas WebGL (deck.gl): el mapa 3D no es operable sin mouse,
 * así que este `<select>` nativo expone la misma acción (`setSelectedComuna`)
 * para que `ComunaDetailPanel` sea alcanzable sin interactuar con el mapa.
 */
export function ComunaKeyboardSelector() {
  const comunasQuery = useComunas();
  const { selectedComuna, setSelectedComuna } = useMapStore();

  const nombres = (comunasQuery.data?.features ?? [])
    .map((f) => f.properties.nombre)
    .sort((a, b) => a.localeCompare(b));

  return (
    <div className="absolute left-4 top-4 z-10 w-64 rounded-lg border border-border bg-card/95 p-4 text-sm shadow-md backdrop-blur">
      <label htmlFor="comuna-select" className="mb-2 block font-heading text-sm font-semibold text-card-foreground">
        Ir a comuna
      </label>
      <select
        id="comuna-select"
        className="w-full rounded-md border border-input bg-background p-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={selectedComuna ?? ""}
        onChange={(e) => setSelectedComuna(e.target.value || null)}
      >
        <option value="">Selecciona una comuna…</option>
        {nombres.map((nombre) => (
          <option key={nombre} value={normalizeComunaName(nombre)}>
            {nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
