"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";
import { useMortalidadRespiratoria } from "@/lib/api/queries";

export function MortalidadRespiratoriaCard() {
  const query = useMortalidadRespiratoria();

  const data = useMemo(() => {
    if (!query.data) return [];
    return [...query.data.comunas]
      .map((c) => ({
        comuna: c.comuna.replace("Corregimiento de ", ""),
        tasa: c.tasa_x100mil,
        muertes: c.muertes_2017_2021,
      }))
      .sort((a, b) => b.tasa - a.tasa);
  }, [query.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mortalidad respiratoria por comuna (MEData, 2017-2021)</CardTitle>
        <CardDescription>
          Muertes por causas respiratorias por 100 mil habitantes por año, según comuna de
          residencia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MethodologyNote>
          Tasa cruda sin ajustar por edad: las comunas más envejecidas pesan más. MEData muestra
          dónde se concentra la mortalidad respiratoria, pero sin ajustar por edad no permite
          atribuirla al aire ni al arbolado.
        </MethodologyNote>

        {query.isLoading && <div className="h-72 animate-pulse rounded-md bg-muted" />}
        {query.isError && (
          <p className="text-sm text-critical">
            No se pudo cargar la gráfica: {(query.error as Error).message}
          </p>
        )}
        {query.isSuccess && (
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
                    value: "por 100 mil hab./año",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${Number(value).toLocaleString("es-CO", { maximumFractionDigits: 1 })} por 100 mil hab./año (${(item.payload as { muertes: number }).muertes.toLocaleString("es-CO")} muertes)`,
                    "Tasa cruda",
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
                <Bar dataKey="tasa" radius={[4, 4, 0, 0]} fill="var(--color-warning)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
