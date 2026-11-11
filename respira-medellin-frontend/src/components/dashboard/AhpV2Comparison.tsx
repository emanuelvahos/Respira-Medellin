"use client";

import { ArrowDownIcon, ArrowUpIcon, EqualsIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAhpV2, useAhpV2Resumen } from "@/lib/api/queries";

const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });

function Cambio({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return <span className="text-muted-foreground">—</span>;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <EqualsIcon aria-hidden size={14} /> Igual
      </span>
    );
  }
  const sube = delta > 0;
  const Icono = sube ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-foreground">
      <Icono aria-hidden size={14} />
      {sube ? "Sube" : "Baja"} {Math.abs(delta)}
    </span>
  );
}

export function AhpV2Comparison() {
  const datos = useAhpV2();
  const resumen = useAhpV2Resumen();

  if (datos.isLoading || resumen.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-72" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (datos.isError || resumen.isError || !datos.data || !resumen.data) {
    return (
      <p className="text-sm text-critical">
        No se pudo cargar la comparación v1 vs v2:{" "}
        {((datos.error ?? resumen.error) as Error | null)?.message ?? "sin datos"}
      </p>
    );
  }

  const r = resumen.data;
  const filas = datos.data
    .filter((c) => c.grupo === "original" && c.rank_v2_11 != null)
    .sort((a, b) => (a.rank_v2_11 ?? 99) - (b.rank_v2_11 ?? 99));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Priorización con el inventario de árboles actualizado (AHP v2)</CardTitle>
        <CardDescription>
          Misma fórmula y mismos pesos ({r.pesos.pm25} PM2.5 / {r.pesos.deficit} déficit /{" "}
          {r.pesos.area} área); solo cambia de dónde sale el conteo de árboles. El modelo original (v1)
          usa un inventario con {fmt(r.arboles_v1_total_11_comunas)} árboles en estas 11 comunas; el SAU
          vigente registra {fmt(r.arboles_vivos_sau_total_11_comunas)} árboles vivos en las mismas. El v1 no se
          modifica: esta tabla permite compararlos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground">
          <strong>{r.top5_coinciden} de las 5</strong> comunas prioritarias coinciden entre v1 y v2
          (correlación de posiciones: {fmt(r.spearman_rank_v1_vs_v2_11, 2)}). Las posiciones cambian
          sobre todo en el medio de la tabla, porque el déficit de especies mitigadoras es parecido en
          todas las comunas.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comuna</TableHead>
                <TableHead className="text-right">Árboles vivos (SAU)</TableHead>
                <TableHead className="text-right">% mitigadoras v1</TableHead>
                <TableHead className="text-right">% mitigadoras v2</TableHead>
                <TableHead className="text-right">Posición v1</TableHead>
                <TableHead className="text-right">Posición v2</TableHead>
                <TableHead>Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((c) => (
                <TableRow key={c.comuna}>
                  <TableCell className="font-medium">{c.comuna}</TableCell>
                  <TableCell className="text-right">{fmt(c.arboles_vivos_sau)}</TableCell>
                  <TableCell className="text-right">{fmt(c.ratio_mitigadores_v1_pct, 1)}%</TableCell>
                  <TableCell className="text-right">{fmt(c.ratio_mitigadores_v2_pct, 1)}%</TableCell>
                  <TableCell className="text-right">{c.rank_v1_11 ?? "—"}</TableCell>
                  <TableCell className="text-right">{c.rank_v2_11 ?? "—"}</TableCell>
                  <TableCell>
                    <Cambio delta={c.cambio_posicion_11} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <WarningCircleIcon aria-hidden size={16} className="mt-0.5 shrink-0" />
          <span>
            {r.advertencia} Especies mitigadoras consideradas: {r.especies_mitigadoras.join(", ")}.
            Posiciones calculadas entre las 11 comunas originales; PM2.5 y área apta no cambian entre v1 y v2.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
