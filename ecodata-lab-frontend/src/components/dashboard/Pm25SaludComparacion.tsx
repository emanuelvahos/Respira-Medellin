"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";
import { useResumenComuna, useSaludResumenComuna } from "@/lib/api/queries";

const TOP_N = 8;

/**
 * Dos rankings independientes lado a lado — nunca un solo gráfico combinado
 * que insinúe una relación causal. El texto y el layout evitan
 * deliberadamente cualquier flecha o línea que conecte ambas listas.
 */
export function Pm25SaludComparacion() {
  const resumenQuery = useResumenComuna();
  const saludQuery = useSaludResumenComuna();

  const topPm25 = useMemo(() => {
    if (!resumenQuery.data) return [];
    return resumenQuery.data
      .filter((c) => c.pm25_promedio != null)
      .sort((a, b) => (b.pm25_promedio ?? 0) - (a.pm25_promedio ?? 0))
      .slice(0, TOP_N);
  }, [resumenQuery.data]);

  const topSalud = useMemo(() => {
    if (!saludQuery.data) return [];
    return [...saludQuery.data.comunas]
      .sort((a, b) => b.total_diagnosticos_respiratorios - a.total_diagnosticos_respiratorios)
      .slice(0, TOP_N);
  }, [saludQuery.data]);

  if (resumenQuery.isLoading || saludQuery.isLoading) {
    // Misma estructura que la tarjeta real (header, nota de metodología, dos
    // columnas de TOP_N filas) — sin esto el salto de una tarjeta de 48px a
    // esta era uno de los mayores contribuyentes al CLS de /dashboard.
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-64" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-14 w-full rounded-md" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, col) => (
              <div key={col}>
                <Skeleton className="mb-2 h-4 w-44" />
                <ol className="space-y-1.5">
                  {Array.from({ length: TOP_N }).map((_, row) => (
                    <li key={row} className="flex items-center justify-between gap-2">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3.5 w-14" />
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!resumenQuery.data || !saludQuery.data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dos indicadores observados por separado</CardTitle>
        <CardDescription>
          Comunas con mayor PM2.5 y comunas con mayor carga respiratoria en la
          red pública, presentadas como dos hechos independientes — esto NO
          es un análisis de correlación ni implica que uno cause el otro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <MethodologyNote>
          Ventanas temporales distintas y solo parcialmente solapadas: PM2.5
          es 2023-2025, la carga respiratoria es 2024-2026. No asumas que
          corresponden al mismo periodo exacto.
        </MethodologyNote>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Mayor PM2.5 promedio
            </p>
            <ol className="space-y-1.5 text-sm">
              {topPm25.map((c, i) => (
                <li key={c.comuna} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {i + 1}. {c.comuna}
                  </span>
                  <span className="font-medium text-foreground">
                    {c.pm25_promedio?.toFixed(1)} µg/m³
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Mayor carga respiratoria (red pública)
            </p>
            <ol className="space-y-1.5 text-sm">
              {topSalud.map((c, i) => (
                <li key={c.comuna} className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {i + 1}. {c.comuna}
                  </span>
                  <span className="font-medium text-foreground">
                    {c.total_diagnosticos_respiratorios.toLocaleString("es-CO")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
