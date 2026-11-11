"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowsDownUpIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useResumenComuna } from "@/lib/api/queries";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";

// Umbrales inspirados en las categorías OMS ya usadas en el dataset
// (`categoria_oms` de integracion_v2_pm25_arboles_medellin.csv), simplificados
// a 3 niveles para el color de barra. Tokens del design system, no colores nuevos.
function nivelColor(pm25: number): string {
  if (pm25 < 15) return "var(--color-vegetation)";
  if (pm25 < 25) return "var(--color-warning)";
  return "var(--color-critical)";
}

export function Pm25BarChart() {
  const resumenQuery = useResumenComuna();
  const [orden, setOrden] = useState<"desc" | "asc">("desc");

  const data = useMemo(() => {
    if (!resumenQuery.data) return [];
    return resumenQuery.data
      .filter((c) => c.pm25_promedio != null)
      .map((c) => ({
        // Prefijo "≈" en el eje X: PM2.5 estimado (interpolación IDW), no
        // medido. Prefijo "⏱" (distinto): PM2.5 histórico/no-vigente
        // (Altavista) — señal visible sin depender solo del color de la barra.
        comuna:
          c.pm25_tipo_dato === "interpolado"
            ? `≈ ${c.comuna}`
            : c.pm25_tipo_dato === "historico"
              ? `⏱ ${c.comuna}`
              : c.comuna,
        pm25: c.pm25_promedio as number,
        estimado: c.pm25_tipo_dato === "interpolado",
        historico: c.pm25_tipo_dato === "historico",
        fechaUltimoDato: c.pm25_fecha_ultimo_dato ?? null,
      }))
      .sort((a, b) => (orden === "desc" ? b.pm25 - a.pm25 : a.pm25 - b.pm25));
  }, [resumenQuery.data, orden]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>PM2.5 promedio por comuna</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOrden((o) => (o === "desc" ? "asc" : "desc"))}
        >
          <ArrowsDownUpIcon size={16} />
          {orden === "desc" ? "Mayor a menor" : "Menor a mayor"}
        </Button>
      </CardHeader>
      <CardContent>
        {resumenQuery.isLoading && (
          <div className="h-72 animate-pulse rounded-md bg-muted" />
        )}
        {resumenQuery.isError && (
          <p className="text-sm text-critical">
            No se pudo cargar la gráfica: {(resumenQuery.error as Error).message}
          </p>
        )}
        {resumenQuery.isSuccess && (
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
                    value: "µg/m³",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${Number(value).toFixed(1)} µg/m³${
                      item?.payload?.estimado
                        ? " (estimado por interpolación IDW, no medido)"
                        : item?.payload?.historico
                          ? ` (histórico, no vigente — activa hasta ${item?.payload?.fechaUltimoDato ?? "fecha desconocida"})`
                          : ""
                    }`,
                    "PM2.5",
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
                <Bar dataKey="pm25" radius={[4, 4, 0, 0]}>
                  {data.map((d) => (
                    <Cell
                      key={d.comuna}
                      fill={nivelColor(d.pm25)}
                      // Barras con dato interpolado (IDW, no medido): opacidad
                      // reducida + borde punteado, distinguibles de las barras
                      // con dato medido a simple vista (además del "≈" en el
                      // eje X y el detalle del tooltip).
                      fillOpacity={d.estimado ? 0.55 : d.historico ? 0.75 : 1}
                      stroke={
                        d.estimado
                          ? "var(--color-critical)"
                          : d.historico
                            ? "var(--color-data-sky)"
                            : undefined
                      }
                      strokeWidth={d.estimado || d.historico ? 1.5 : 0}
                      strokeDasharray={d.estimado ? "3 2" : undefined}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.some((d) => d.estimado) && (
          <div className="mt-3">
            <MethodologyNote>
              <span className="text-critical">≈</span> Barra punteada y translúcida
              (Popular, Manrique, Doce de Octubre): PM2.5 <strong>estimado</strong>{" "}
              por interpolación espacial (IDW) a partir de estaciones SIATA
              cercanas, no medido directamente por ninguna estación dentro de
              la comuna. El score AHP de estas comunas hereda esa
              incertidumbre — ver el panel de detalle de cada comuna para la
              distancia real a la estación más cercana.
            </MethodologyNote>
          </div>
        )}
        {data.some((d) => d.historico) && (
          <div className="mt-3">
            <MethodologyNote>
              <span className="text-data-sky">⏱</span> Barra de borde sólido
              azul (Altavista): PM2.5 <strong>real pero histórico, no
              vigente</strong> — promedio del último año de datos de la
              estación MED-ALTA2 (Corantioquia/SISAIRE), inactiva desde
              2025-09-25. Es una medición directa, pero no representa
              necesariamente las condiciones actuales de la comuna.
            </MethodologyNote>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
