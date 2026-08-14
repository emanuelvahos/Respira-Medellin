"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CaretUpDownIcon,
  MagnifyingGlassIcon,
  MinusIcon,
} from "@phosphor-icons/react/dist/ssr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePoblacionComuna, useRankingComunas } from "@/lib/api/queries";
import { PESOS_AHP_ORIGINALES, type PesosAhp, type RankingComunaItem } from "@/types/rankingComuna";
import { normalizeComunaName } from "@/lib/map/matchComuna";
import { cn } from "@/lib/utils";

// Normaliza tildes para que buscar "belen" encuentre "Belén" — nombres de
// comuna reales llevan acento y no todo el mundo lo escribe al buscar.
function sinTildes(s: string): string {
  return s
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code < 0x0300 || code > 0x036f; // fuera del rango de marcas diacríticas combinantes
    })
    .join("");
}

function CambioRanking({ actual, base }: { actual: number; base: number | undefined }) {
  if (base == null || base === actual) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground" title="Sin cambio">
        <MinusIcon size={12} />
      </span>
    );
  }
  const subio = actual < base; // ranking más bajo (#1) = mejor posición
  const delta = Math.abs(base - actual);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        subio ? "text-vegetation" : "text-critical",
      )}
      title={`Posición original: #${base}`}
    >
      {subio ? <ArrowUpIcon size={12} weight="bold" /> : <ArrowDownIcon size={12} weight="bold" />}
      {delta}
    </span>
  );
}

type RankingComunaConPoblacion = RankingComunaItem & {
  poblacion?: number | null;
  densidad_hab_km2?: number | null;
};

const columns: ColumnDef<RankingComunaConPoblacion>[] = [
  {
    id: "ranking_prioridad",
    accessorKey: "ranking_prioridad",
    header: "#",
    cell: ({ row }) => <span className="tabular-nums">{row.original.ranking_prioridad}</span>,
  },
  {
    accessorKey: "comuna",
    header: "Comuna",
    cell: ({ row }) => <span className="font-medium text-foreground">{row.original.comuna}</span>,
  },
  {
    accessorKey: "score_total",
    header: "Score",
    cell: ({ row }) => row.original.score_total.toFixed(4),
  },
  {
    accessorKey: "pm25_promedio",
    header: "PM2.5",
    cell: ({ row }) =>
      row.original.pm25_promedio != null ? `${row.original.pm25_promedio.toFixed(1)} µg/m³` : "—",
  },
  {
    accessorKey: "deficit_pct",
    header: "Déficit",
    cell: ({ row }) =>
      row.original.deficit_pct != null ? `${row.original.deficit_pct.toFixed(1)}%` : "—",
  },
  {
    accessorKey: "area_total_disponible_ha",
    header: "Área disp.",
    cell: ({ row }) => `${row.original.area_total_disponible_ha.toFixed(1)} ha`,
  },
  {
    accessorKey: "especie_principal",
    header: "Especie principal",
  },
  {
    accessorKey: "poblacion",
    header: "Población",
    cell: ({ row }) =>
      row.original.poblacion != null
        ? row.original.poblacion.toLocaleString("es-CO")
        : "—",
  },
  {
    accessorKey: "densidad_hab_km2",
    header: "Densidad",
    cell: ({ row }) =>
      row.original.densidad_hab_km2 != null
        ? `${Math.round(row.original.densidad_hab_km2).toLocaleString("es-CO")} hab/km²`
        : "—",
  },
];

export function ComunasTable({ pesos }: { pesos: PesosAhp }) {
  const rankingQuery = useRankingComunas(pesos);
  const baselineQuery = useRankingComunas(PESOS_AHP_ORIGINALES);
  const poblacionQuery = usePoblacionComuna();
  const [sorting, setSorting] = useState<SortingState>([{ id: "ranking_prioridad", desc: false }]);
  const [busqueda, setBusqueda] = useState("");

  const baselineRankPorComuna = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of baselineQuery.data ?? []) map.set(r.comuna, r.ranking_prioridad);
    return map;
  }, [baselineQuery.data]);

  const poblacionPorComuna = useMemo(() => {
    const map = new Map<string, { poblacion: number; densidad_hab_km2: number | null | undefined }>();
    for (const p of poblacionQuery.data ?? []) {
      map.set(normalizeComunaName(p.nombre_comuna), {
        poblacion: p.poblacion,
        densidad_hab_km2: p.densidad_hab_km2,
      });
    }
    return map;
  }, [poblacionQuery.data]);

  const data = useMemo<RankingComunaConPoblacion[]>(
    () =>
      (rankingQuery.data ?? []).map((r) => {
        const pob = poblacionPorComuna.get(normalizeComunaName(r.comuna));
        return { ...r, poblacion: pob?.poblacion, densidad_hab_km2: pob?.densidad_hab_km2 };
      }),
    [rankingQuery.data, poblacionPorComuna],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: busqueda },
    onSortingChange: setSorting,
    onGlobalFilterChange: setBusqueda,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) =>
      sinTildes(row.original.comuna.toLowerCase()).includes(
        sinTildes(String(filterValue).toLowerCase()),
      ),
  });

  if (rankingQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-md bg-muted" />;
  }
  if (rankingQuery.isError) {
    return (
      <p className="text-sm text-critical">
        No se pudo cargar el ranking: {(rankingQuery.error as Error).message}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <MagnifyingGlassIcon
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Buscar comuna..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8"
          />
        </div>
        <Badge variant="secondary" className="shrink-0">
          Cambio vs. pesos originales
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {table.getHeaderGroups()[0].headers.map((header) => (
              <TableHead key={header.id}>
                <button
                  type="button"
                  onClick={header.column.getToggleSortingHandler()}
                  className="inline-flex items-center gap-1 select-none hover:text-foreground"
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" && <ArrowUpIcon size={12} />}
                  {header.column.getIsSorted() === "desc" && <ArrowDownIcon size={12} />}
                  {!header.column.getIsSorted() && <CaretUpDownIcon size={12} className="opacity-40" />}
                </button>
              </TableHead>
            ))}
            <TableHead>Cambio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground">
                Sin resultados para &quot;{busqueda}&quot;
              </TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
              <TableCell>
                <CambioRanking
                  actual={row.original.ranking_prioridad}
                  base={baselineRankPorComuna.get(row.original.comuna)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
