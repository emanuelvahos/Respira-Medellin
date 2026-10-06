"use client";

import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNdvi } from "@/lib/api/queries";

const fmt = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

export function NdviEvidencia() {
  const q = useNdvi();
  if (q.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-72" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-critical">No se pudo cargar la evidencia satelital: {(q.error as Error | null)?.message ?? "sin datos"}</p>;
  }
  const r = q.data;
  const max = Math.max(...r.comunas.map((c) => c.ndvi_mediana ?? 0), 0.01);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidencia satelital: verdor por comuna (NDVI)</CardTitle>
        <CardDescription>
          {r.fuente}. Periodo {r.periodo}, {r.fechas_utilizadas} fechas sin nube, {r.resolucion_m} m de resolución.
          Un NDVI más alto significa más vegetación vista desde el satélite.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm">
          {r.correlaciones.map((c) => (
            <li key={c.variable}>
              <strong>{c.variable}</strong> vs NDVI en {c.n_comunas} comunas urbanas: correlación de Spearman{" "}
              <strong>{fmt(c.spearman, 2)}</strong>. {c.lectura}
            </li>
          ))}
        </ul>
        <div role="note" className="flex gap-2 rounded-md border border-warning bg-warning/10 p-3 text-xs">
          <WarningCircleIcon aria-hidden size={16} className="mt-0.5 shrink-0" />
          <ul className="list-disc space-y-1 pl-4">
            {r.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comuna</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="min-w-40">NDVI (mediana)</TableHead>
                <TableHead className="text-right">% vegetación densa</TableHead>
                <TableHead className="text-right">Árboles SAU / km²</TableHead>
                <TableHead className="text-right">Árboles SAU / 1.000 hab.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.comunas.map((c) => (
                <TableRow key={c.comuna}>
                  <TableCell className="font-medium">{c.comuna}</TableCell>
                  <TableCell>{c.es_urbana ? "Urbana" : "Corregimiento"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded bg-muted" aria-hidden>
                        <div className="h-2 rounded bg-vegetation" style={{ width: `${((c.ndvi_mediana ?? 0) / max) * 100}%` }} />
                      </div>
                      <span className="tabular-nums">{fmt(c.ndvi_mediana, 2)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(c.pct_vegetacion_densa, 1)} %</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(c.arboles_por_km2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(c.arboles_por_1000_hab, 1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
