"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowsDownUpIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";
import { useSaludResumenComuna } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

export function SaludRespiratoriaBarChart() {
  const saludQuery = useSaludResumenComuna();
  const [orden, setOrden] = useState<"desc" | "asc">("desc");
  const [modo, setModo] = useState<"conteo" | "tasa">("conteo");

  const data = useMemo(() => {
    if (!saludQuery.data) return [];
    return [...saludQuery.data.comunas]
      .map((c) => ({
        comuna: c.comuna,
        total: c.total_diagnosticos_respiratorios,
        tasa: c.tasa_por_1000_hab ?? null,
      }))
      .filter((c) => modo === "conteo" || c.tasa != null)
      .sort((a, b) => {
        const av = modo === "conteo" ? a.total : (a.tasa ?? 0);
        const bv = modo === "conteo" ? b.total : (b.tasa ?? 0);
        return orden === "desc" ? bv - av : av - bv;
      });
  }, [saludQuery.data, orden, modo]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Diagnósticos respiratorios por comuna (red pública Metrosalud)</CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setModo("conteo")}
              aria-pressed={modo === "conteo"}
              className={cn(
                "rounded px-2 py-1",
                modo === "conteo" ? "bg-vegetation-muted text-vegetation" : "text-muted-foreground",
              )}
            >
              Conteo absoluto
            </button>
            <button
              type="button"
              onClick={() => setModo("tasa")}
              aria-pressed={modo === "tasa"}
              className={cn(
                "rounded px-2 py-1",
                modo === "tasa" ? "bg-vegetation-muted text-vegetation" : "text-muted-foreground",
              )}
            >
              Tasa /1.000 hab.
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrden((o) => (o === "desc" ? "asc" : "desc"))}
          >
            <ArrowsDownUpIcon size={16} />
            {orden === "desc" ? "Mayor a menor" : "Menor a mayor"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <MethodologyNote>
          {modo === "tasa"
            ? "Tasa por 1.000 habitantes: usa la población total proyectada de la comuna (DANE) como denominador, aunque el numerador son solo pacientes de la red pública Metrosalud (régimen subsidiado) — puede subestimar o sobreestimar la carga real según cuánto varíe la cobertura subsidiada entre comunas. Comunas donde no fue posible cruzar la población no aparecen en este modo."
            : "Datos de la red pública Metrosalud (régimen subsidiado); no representa la morbilidad respiratoria total de la ciudad — pacientes de EPS del régimen contributivo atendidos en clínicas privadas no aparecen aquí. El conteo absoluto favorece a comunas más pobladas: compara con la tasa por 1.000 hab. para un panorama más equilibrado. Diagnósticos CIE-10 J00-J99, periodo 2024-2026 (se solapa solo parcialmente con la ventana de PM2.5 2023-2025 del resto del dashboard)."}
        </MethodologyNote>

        {saludQuery.isLoading && (
          <div className="h-72 animate-pulse rounded-md bg-muted" />
        )}
        {saludQuery.isError && (
          <p className="text-sm text-critical">
            No se pudo cargar la gráfica: {(saludQuery.error as Error).message}
          </p>
        )}
        {saludQuery.isSuccess && (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="comuna"
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  label={{
                    value: modo === "tasa" ? "por 1.000 hab." : "diagnósticos",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                <Tooltip
                  formatter={(value) => [
                    modo === "tasa"
                      ? `${Number(value).toFixed(1)} / 1.000 hab.`
                      : Number(value).toLocaleString("es-CO"),
                    "Diagnósticos J00-J99",
                  ]}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                  itemStyle={{ color: "var(--color-foreground)" }}
                />
                <Bar
                  dataKey={modo === "tasa" ? "tasa" : "total"}
                  radius={[4, 4, 0, 0]}
                  fill="var(--color-warning)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
