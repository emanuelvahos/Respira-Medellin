"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowsDownUpIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useResumenComuna } from "@/lib/api/queries";

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
      .map((c) => ({ comuna: c.comuna, pm25: c.pm25_promedio as number }))
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
                  formatter={(value) => [`${Number(value).toFixed(1)} µg/m³`, "PM2.5"]}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="pm25" radius={[4, 4, 0, 0]}>
                  {data.map((d) => (
                    <Cell key={d.comuna} fill={nivelColor(d.pm25)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
