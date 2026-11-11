"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useArbolesComunasDetalle } from "@/lib/api/queries";

const fmt = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function ArbolesPorComuna() {
  const q = useArbolesComunasDetalle();

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
    return <p className="text-sm text-critical">No se pudo cargar el detalle de árboles por comuna: {(q.error as Error | null)?.message ?? "sin datos"}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Árboles por comuna y por qué cada una es prioridad</CardTitle>
        <CardDescription>
          Árboles vivos del inventario SAU. La densidad por 1.000 habitantes y el % de especies mitigadoras
          permiten comparar comunas de distinto tamaño. Los registros recientes son registros nuevos en el
          inventario, no necesariamente siembras recientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:hidden" aria-label="Árboles por comuna">
          {q.data.map((c) => (
            <li key={c.comuna} className="rounded-lg border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{c.comuna}</span>
                <span className="text-xs text-muted-foreground">
                  {c.ranking_v2 != null ? `Prioridad #${c.ranking_v2}` : "Sin dato PM2.5"}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Árboles vivos</dt>
                  <dd className="tabular-nums font-medium">{fmt(c.arboles_vivos)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Por 1.000 hab.</dt>
                  <dd className="tabular-nums font-medium">{fmt(c.arboles_por_1000_hab, 1)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">% mitigadoras</dt>
                  <dd className="tabular-nums font-medium">{fmt(c.ratio_mitigadores_pct, 1)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card">Comuna</TableHead>
              <TableHead className="text-right">Árboles vivos</TableHead>
              <TableHead className="text-right">Por 1.000 hab.</TableHead>
              <TableHead className="text-right">Por km²</TableHead>
              <TableHead className="text-right">% mitigadoras</TableHead>
              <TableHead className="text-right">Talados</TableHead>
              <TableHead className="text-right">Registros últimos 3 años</TableHead>
              <TableHead className="text-right">Prioridad AHP v2</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((c) => (
              <TableRow key={c.comuna}>
                <TableCell className="sticky left-0 z-10 bg-card font-medium">{c.comuna}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.arboles_vivos)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.arboles_por_1000_hab, 1)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.arboles_por_km2)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.ratio_mitigadores_pct, 1)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.talados)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(c.registros_ultimos_3_anios)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.ranking_v2 != null ? `#${c.ranking_v2}` : "Sin dato PM2.5"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}
