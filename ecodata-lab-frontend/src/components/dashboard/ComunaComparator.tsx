"use client";

import { useMemo, useState } from "react";
import { CheckCircleIcon, ScalesIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";
import {
  useComunas,
  useResumenComuna,
  useArbolesResumenComuna,
  useSaludResumenComuna,
} from "@/lib/api/queries";
import { useMapStore } from "@/store/mapStore";
import { normalizeComunaName } from "@/lib/map/matchComuna";

const NO_DISPONIBLE = "No disponible en el modelo actual";
const MAX_COLUMNAS = 3;

type Fila = {
  key: string;
  label: string;
  /** true = el valor más alto se resalta como "mejor"; false = el más bajo. */
  altoEsMejor: boolean;
  formatear: (v: number) => string;
  valores: (comuna: string) => number | null;
};

/**
 * Selección inicial: si el usuario llega desde el mapa con una comuna ya
 * elegida (`useMapStore().selectedComuna` persiste entre páginas porque es un
 * store global), pre-rellenamos solo la primera columna. Es una ayuda, no una
 * sorpresa: no fuerza ninguna comparación, solo evita repetir un clic que el
 * usuario ya hizo en el mapa; si no viene de ahí, arranca vacío.
 */
function useSeleccionInicial(): string | null {
  const selectedComuna = useMapStore((s) => s.selectedComuna);
  const [inicial] = useState(selectedComuna);
  return inicial;
}

export function ComunaComparator() {
  const comunasQuery = useComunas();
  const resumenQuery = useResumenComuna();
  const arbolesQuery = useArbolesResumenComuna();
  const saludQuery = useSaludResumenComuna();

  const seleccionInicial = useSeleccionInicial();
  const [seleccion, setSeleccion] = useState<(string | null)[]>([
    seleccionInicial,
    null,
    null,
  ]);

  const nombres = useMemo(
    () =>
      (comunasQuery.data?.features ?? [])
        .map((f) => f.properties.nombre)
        .sort((a, b) => a.localeCompare(b)),
    [comunasQuery.data],
  );

  const comunasActivas = seleccion.filter((c): c is string => c !== null);

  const nombrePorNormalizado = useMemo(() => {
    const map = new Map<string, string>();
    for (const nombre of nombres) map.set(normalizeComunaName(nombre), nombre);
    return map;
  }, [nombres]);

  const filas: Fila[] = useMemo(
    () => [
      {
        key: "pm25",
        label: "PM2.5 promedio (µg/m³)",
        altoEsMejor: false,
        formatear: (v) => v.toFixed(1),
        valores: (comuna) =>
          resumenQuery.data?.find((r) => normalizeComunaName(r.comuna) === comuna)
            ?.pm25_promedio ?? null,
      },
      {
        key: "score_ahp",
        label: "Score de priorización AHP",
        altoEsMejor: false,
        formatear: (v) => v.toFixed(3),
        valores: (comuna) =>
          resumenQuery.data?.find((r) => normalizeComunaName(r.comuna) === comuna)
            ?.score_multicriteria ?? null,
      },
      {
        key: "deficit",
        label: "Déficit de mitigadores (%)",
        altoEsMejor: false,
        formatear: (v) => `${v.toFixed(1)}%`,
        valores: (comuna) =>
          resumenQuery.data?.find((r) => normalizeComunaName(r.comuna) === comuna)
            ?.deficit_pct ?? null,
      },
      {
        key: "area",
        label: "Área disponible para siembra (ha)",
        altoEsMejor: true,
        formatear: (v) => v.toFixed(1),
        valores: (comuna) =>
          resumenQuery.data?.find((r) => normalizeComunaName(r.comuna) === comuna)
            ?.area_total_disponible_ha ?? null,
      },
      {
        key: "arboles_sau",
        label: "Árboles inventariados (SAU)",
        altoEsMejor: true,
        formatear: (v) => v.toLocaleString("es-CO"),
        valores: (comuna) =>
          arbolesQuery.data?.find((r) => normalizeComunaName(r.comuna) === comuna)
            ?.total_arboles ?? null,
      },
      {
        key: "carga_respiratoria",
        label: "Diagnósticos respiratorios (Metrosalud)",
        altoEsMejor: false,
        formatear: (v) => v.toLocaleString("es-CO"),
        valores: (comuna) =>
          saludQuery.data?.comunas.find((r) => normalizeComunaName(r.comuna) === comuna)
            ?.total_diagnosticos_respiratorios ?? null,
      },
    ],
    [resumenQuery.data, arbolesQuery.data, saludQuery.data],
  );

  function handleChange(index: number, value: string) {
    setSeleccion((prev) => {
      const next = [...prev];
      next[index] = value || null;
      return next;
    });
  }

  const cargando =
    comunasQuery.isLoading || resumenQuery.isLoading || arbolesQuery.isLoading || saludQuery.isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparar comunas</CardTitle>
        <CardDescription>
          Elige 2 o 3 comunas para ver sus indicadores lado a lado — útil para
          responder preguntas puntuales tipo &quot;¿cómo se compara esta
          comuna contra aquella?&quot; en una discusión directa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: MAX_COLUMNAS }).map((_, i) => (
            <div key={i} className="space-y-1">
              <label
                htmlFor={`comparador-comuna-${i}`}
                className="block text-xs font-medium text-muted-foreground"
              >
                Comuna {i + 1}
                {i === MAX_COLUMNAS - 1 ? " (opcional)" : ""}
              </label>
              <select
                id={`comparador-comuna-${i}`}
                className="w-full rounded-md border border-input bg-background p-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={seleccion[i] ?? ""}
                onChange={(e) => handleChange(i, e.target.value)}
              >
                <option value="">Selecciona una comuna…</option>
                {nombres.map((nombre) => (
                  <option key={nombre} value={normalizeComunaName(nombre)}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <MethodologyNote>
          Los diagnósticos respiratorios provienen solo de la red pública
          Metrosalud (régimen subsidiado); no representan la morbilidad
          respiratoria total de la comuna. Periodo 2024-2026, se solapa solo
          parcialmente con la ventana de PM2.5 2023-2025 del resto del
          dashboard.
        </MethodologyNote>

        {comunasActivas.length < 2 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            <ScalesIcon size={28} className="text-muted-foreground/60" />
            <p>
              Elige al menos 2 comunas arriba para comparar sus indicadores.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  {comunasActivas.map((comuna) => (
                    <TableHead key={comuna} className="text-right">
                      {nombrePorNormalizado.get(comuna) ?? comuna}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => {
                  const valoresPorComuna = comunasActivas.map((comuna) => ({
                    comuna,
                    valor: fila.valores(comuna),
                  }));
                  const numericos = valoresPorComuna
                    .map((v) => v.valor)
                    .filter((v): v is number => v !== null);
                  const mejor =
                    numericos.length >= 2
                      ? fila.altoEsMejor
                        ? Math.max(...numericos)
                        : Math.min(...numericos)
                      : null;
                  const peor =
                    numericos.length >= 2
                      ? fila.altoEsMejor
                        ? Math.min(...numericos)
                        : Math.max(...numericos)
                      : null;

                  return (
                    <TableRow key={fila.key}>
                      <TableCell className="font-medium text-foreground">
                        {fila.label}
                      </TableCell>
                      {valoresPorComuna.map(({ comuna, valor }) => {
                        const esMejor =
                          mejor !== null && valor !== null && valor === mejor && mejor !== peor;
                        const esPeor =
                          peor !== null && valor !== null && valor === peor && mejor !== peor;
                        return (
                          <TableCell
                            key={comuna}
                            className={`text-right tabular-nums ${
                              esMejor
                                ? "font-semibold text-vegetation"
                                : esPeor
                                  ? "font-semibold text-critical"
                                  : "text-foreground"
                            }`}
                          >
                            <span className="inline-flex items-center justify-end gap-1">
                              {esMejor && <CheckCircleIcon size={12} aria-hidden="true" />}
                              {esPeor && <WarningCircleIcon size={12} aria-hidden="true" />}
                              {valor === null ? (
                                <span className="font-normal italic text-muted-foreground">
                                  {NO_DISPONIBLE}
                                </span>
                              ) : (
                                fila.formatear(valor)
                              )}
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {cargando && (
          <p className="text-xs text-muted-foreground">Cargando indicadores…</p>
        )}
      </CardContent>
    </Card>
  );
}
