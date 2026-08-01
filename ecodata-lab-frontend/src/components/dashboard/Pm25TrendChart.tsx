"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePM25 } from "@/lib/api/queries";

export function Pm25TrendChart() {
  const pm25Query = usePM25();

  const comunas = useMemo(() => {
    if (!pm25Query.data) return [];
    return Array.from(new Set(pm25Query.data.map((r) => r.comuna))).sort();
  }, [pm25Query.data]);

  const [comunaSeleccionada, setComunaSeleccionada] = useState<string | null>(null);
  const comunaActiva = comunaSeleccionada ?? comunas[0] ?? null;

  const anios = useMemo(
    () => Array.from(new Set((pm25Query.data ?? []).map((r) => r.anio))).sort(),
    [pm25Query.data],
  );

  const data = useMemo(() => {
    if (!pm25Query.data || !comunaActiva) return [];
    // Promedio por año (cada año trae varios cuatrimestres/periodos).
    const porAnio = new Map<number, { suma: number; n: number }>();
    for (const r of pm25Query.data) {
      if (r.comuna !== comunaActiva) continue;
      const acc = porAnio.get(r.anio) ?? { suma: 0, n: 0 };
      acc.suma += r.pm25_promedio_ug_m3;
      acc.n += 1;
      porAnio.set(r.anio, acc);
    }
    return Array.from(porAnio.entries())
      .map(([anio, { suma, n }]) => ({ anio, pm25: suma / n }))
      .sort((a, b) => a.anio - b.anio);
  }, [pm25Query.data, comunaActiva]);

  // Con un solo año real de datos una línea de tendencia no aporta nada
  // (un punto no es tendencia) — se omite la gráfica en vez de simular años
  // ficticios, según lo pedido explícitamente para esta fase.
  if (pm25Query.isSuccess && anios.length <= 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolución temporal de PM2.5</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            El dataset integrado solo tiene {anios.length === 1 ? `un año real (${anios[0]})` : "datos"}{" "}
            de mediciones — se omite esta gráfica en vez de simular una tendencia con años ficticios.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Evolución temporal de PM2.5</CardTitle>
        {comunas.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Comuna
            <select
              value={comunaActiva ?? ""}
              onChange={(e) => setComunaSeleccionada(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {comunas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}
      </CardHeader>
      <CardContent>
        {pm25Query.isLoading && <div className="h-64 animate-pulse rounded-md bg-muted" />}
        {pm25Query.isError && (
          <p className="text-sm text-critical">
            No se pudo cargar la gráfica: {(pm25Query.error as Error).message}
          </p>
        )}
        {pm25Query.isSuccess && anios.length > 1 && (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="anio"
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
                <Line
                  type="monotone"
                  dataKey="pm25"
                  stroke="var(--color-chart-5)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
