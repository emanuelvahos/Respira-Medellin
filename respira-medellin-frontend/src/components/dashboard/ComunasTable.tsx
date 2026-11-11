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
import { Skeleton } from "@/components/ui/skeleton";
import { usePoblacionComuna, useRankingComunas, useResumenComuna } from "@/lib/api/queries";
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
  /** true: comuna con score AHP calculado pero SIN zona de siembra viable
   * identificada (recálculo con zonas verdes reales) — no forma parte del
   * comparador de escenarios AHP (`/api/siembra/ranking-comunas`), se agrega
   * como fila adicional para que no falte de la vista de prioridades. */
  sinZonaSiembra?: boolean;
  /** true: PM2.5 estimado por interpolación espacial (IDW), no medido — ver
   * ComunaDetailPanel/MapLegend para el mismo tratamiento visual. */
  pm25Estimado?: boolean;
  /** true: PM2.5 real pero histórico/no vigente (Altavista, estación
   * MED-ALTA2 inactiva) — CUARTO tratamiento, distinto de `pm25Estimado`. */
  pm25Historico?: boolean;
  /** Fecha (YYYY-MM-DD) del último dato real, solo si `pm25Historico`. */
  pm25FechaUltimoDato?: string | null;
};

const columns: ColumnDef<RankingComunaConPoblacion>[] = [
  {
    id: "ranking_prioridad",
    accessorKey: "ranking_prioridad",
    header: "#",
    cell: ({ row }) =>
      row.original.sinZonaSiembra ? (
        <span className="text-muted-foreground" title="No forma parte del comparador AHP (sin zona de siembra)">
          —
        </span>
      ) : (
        <span className="tabular-nums">{row.original.ranking_prioridad}</span>
      ),
  },
  {
    accessorKey: "comuna",
    header: "Comuna",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        {row.original.comuna}
        {row.original.sinZonaSiembra && (
          <Badge
            variant="outline"
            className="border-dashed border-warning text-[10px] font-normal text-warning"
          >
            Sin zona de siembra
          </Badge>
        )}
        {row.original.pm25Estimado && (
          <Badge
            variant="outline"
            className="border-dotted border-critical text-[10px] font-normal text-critical"
            title="PM2.5 estimado por interpolación espacial (IDW), no medido directamente"
          >
            ≈ PM2.5 estimado
          </Badge>
        )}
        {row.original.pm25Historico && (
          <Badge
            variant="outline"
            className="border-solid border-data-sky text-[10px] font-normal text-data-sky"
            title={`PM2.5 real pero histórico, no vigente — estación activa hasta ${row.original.pm25FechaUltimoDato ?? "fecha desconocida"}`}
          >
            ⏱ PM2.5 histórico
          </Badge>
        )}
      </span>
    ),
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
      row.original.pm25_promedio != null
        ? `${row.original.pm25Estimado ? "≈ " : row.original.pm25Historico ? "⏱ " : ""}${row.original.pm25_promedio.toFixed(1)} µg/m³`
        : "—",
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
    cell: ({ row }) =>
      row.original.sinZonaSiembra ? (
        <span className="italic text-muted-foreground">
          No se identificaron zonas de siembra viables en esta comuna con los
          datos disponibles.
        </span>
      ) : (
        row.original.especie_principal
      ),
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
  // Comunas con score AHP calculado pero sin zona de siembra viable
  // (recálculo con zonas verdes reales): no pasan por el comparador de
  // escenarios (`useRankingComunas`, que replica exactamente el pipeline
  // original de las 11 comunas), se agregan aparte para que la tabla de
  // prioridades no las omita — siempre marcadas, nunca mezcladas como si
  // tuvieran una recomendación completa.
  const resumenQuery = useResumenComuna();
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

  const data = useMemo<RankingComunaConPoblacion[]>(() => {
    const filas = (rankingQuery.data ?? []).map((r) => {
      const pob = poblacionPorComuna.get(normalizeComunaName(r.comuna));
      return { ...r, poblacion: pob?.poblacion, densidad_hab_km2: pob?.densidad_hab_km2 };
    });

    const sinZona = (resumenQuery.data ?? [])
      .filter((r) => !r.tiene_zona_siembra)
      .map((r): RankingComunaConPoblacion => {
        const pob = poblacionPorComuna.get(normalizeComunaName(r.comuna));
        return {
          comuna: r.comuna,
          ranking_prioridad: r.ranking_prioridad,
          ranking_prioridad_original: r.ranking_prioridad,
          score_total: r.score_multicriteria,
          n_pm25: 0,
          n_deficit: 0,
          n_area: 0,
          pm25_promedio: r.pm25_promedio,
          deficit_pct: r.deficit_pct,
          area_total_disponible_ha: r.area_total_disponible_ha,
          especie_principal: r.especie_principal,
          arboles_a_plantar_total: r.arboles_a_plantar_total,
          poblacion: pob?.poblacion,
          densidad_hab_km2: pob?.densidad_hab_km2,
          sinZonaSiembra: true,
          pm25Estimado: r.pm25_tipo_dato === "interpolado",
          pm25Historico: r.pm25_tipo_dato === "historico",
          pm25FechaUltimoDato: r.pm25_fecha_ultimo_dato ?? null,
        };
      });

    return [...filas, ...sinZona];
  }, [rankingQuery.data, resumenQuery.data, poblacionPorComuna]);

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
    // Mismo layout que la tabla real (barra de búsqueda + badge, header de
    // columnas, filas placeholder) — un solo bloque de 256px de alto sin
    // estructura era uno de los mayores contribuyentes al CLS de
    // /dashboard: la tabla real con ~14 filas mide bastante más que eso.
    const columnasSkeleton = columns.length + 1;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-9 w-full max-w-xs" />
          <Skeleton className="h-5 w-40 shrink-0" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columnasSkeleton }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-3.5 w-12" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, row) => (
              <TableRow key={row}>
                {Array.from({ length: columnasSkeleton }).map((_, col) => (
                  <TableCell key={col}>
                    <Skeleton className="h-4 w-full max-w-20" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
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
