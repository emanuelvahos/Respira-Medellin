"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowsDownUpIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";
import { useSaludResumenComuna } from "@/lib/api/queries";

export function SaludRespiratoriaBarChart() {
  const saludQuery = useSaludResumenComuna();
  const [orden, setOrden] = useState<"desc" | "asc">("desc");

  const data = useMemo(() => {
    if (!saludQuery.data) return [];
    return [...saludQuery.data.comunas]
      .map((c) => ({ comuna: c.comuna, total: c.total_diagnosticos_respiratorios }))
      .sort((a, b) => (orden === "desc" ? b.total - a.total : a.total - b.total));
  }, [saludQuery.data, orden]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Diagnósticos respiratorios por comuna (red pública Metrosalud)</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOrden((o) => (o === "desc" ? "asc" : "desc"))}
        >
          <ArrowsDownUpIcon size={16} />
          {orden === "desc" ? "Mayor a menor" : "Menor a mayor"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <MethodologyNote>
          Datos de la red pública Metrosalud (régimen subsidiado); no
          representa la morbilidad respiratoria total de la ciudad —
          pacientes de EPS del régimen contributivo atendidos en clínicas
          privadas no aparecen aquí. Diagnósticos CIE-10 J00-J99, periodo
          2024-2026 (se solapa solo parcialmente con la ventana de PM2.5
          2023-2025 del resto del dashboard).
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
                    value: "diagnósticos",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 11,
                    fill: "var(--color-muted-foreground)",
                  }}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value).toLocaleString("es-CO")}`, "Diagnósticos J00-J99"]}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="var(--color-warning)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
