"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useArbolesResumenComuna } from "@/lib/api/queries";

const FECHA_DESCARGA_SAU = "2026-08-12";

export function ArbolesSauStats() {
  const query = useArbolesResumenComuna();

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-critical">
        No se pudieron cargar los datos del SAU: {(query.error as Error).message}
      </p>
    );
  }

  if (!query.data || query.data.length === 0) return null;

  const comunas = query.data;
  const totalArboles = comunas.reduce((acc, c) => acc + c.total_arboles, 0);

  // Diversidad de especies: agrega top_especies por comuna (cada comuna ya
  // trae solo su top 5) — es una aproximación de "especies más comunes en la
  // ciudad", no un conteo exacto de especies únicas totales (eso requeriría
  // un agregado dedicado en el backend, no necesario para este KPI informativo).
  const especiesAgregadas = new Map<string, { nombreComun: string | null; cantidad: number }>();
  for (const comuna of comunas) {
    for (const especie of comuna.top_especies) {
      const actual = especiesAgregadas.get(especie.especie);
      especiesAgregadas.set(especie.especie, {
        nombreComun: especie.nombre_comun ?? actual?.nombreComun ?? null,
        cantidad: (actual?.cantidad ?? 0) + especie.cantidad,
      });
    }
  }
  const topEspeciesCiudad = Array.from(especiesAgregadas.entries())
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .slice(0, 5);

  // Estado fitosanitario agregado a nivel ciudad.
  const estadoAgregado = new Map<string, number>();
  for (const comuna of comunas) {
    for (const estado of comuna.distribucion_estado) {
      estadoAgregado.set(estado.estado, (estadoAgregado.get(estado.estado) ?? 0) + estado.cantidad);
    }
  }
  const totalConEstado = Array.from(estadoAgregado.values()).reduce((a, b) => a + b, 0) || 1;
  const estadosOrdenados = Array.from(estadoAgregado.entries())
    .map(([estado, cantidad]) => ({ estado, cantidad, porcentaje: (100 * cantidad) / totalConEstado }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventario real del SAU</CardTitle>
        <CardDescription>
          {totalArboles.toLocaleString("es-CO")} árboles registrados en{" "}
          {comunas.length} comunas — fuente distinta al pipeline de recomendación de
          siembra (que sigue usando exclusivamente{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">base_datos_arboles</code>).
          Datos: Sistema de Árbol Urbano, Alcaldía de Medellín, descargados el{" "}
          {FECHA_DESCARGA_SAU}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Especies más comunes</p>
          <ul className="space-y-1.5 text-sm">
            {topEspeciesCiudad.map(([especie, info]) => (
              <li key={especie} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {especie}
                  {info.nombreComun ? ` (${info.nombreComun})` : ""}
                </span>
                <span className="font-medium text-foreground">
                  {info.cantidad.toLocaleString("es-CO")}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Estado fitosanitario</p>
          <ul className="space-y-1.5 text-sm">
            {estadosOrdenados.slice(0, 5).map((e) => (
              <li key={e.estado} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{e.estado}</span>
                <span className="font-medium text-foreground">{e.porcentaje.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
