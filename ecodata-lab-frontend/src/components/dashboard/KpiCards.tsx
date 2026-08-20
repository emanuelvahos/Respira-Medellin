"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useResumenComuna } from "@/lib/api/queries";

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-3xl font-semibold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function KpiCards() {
  const resumenQuery = useResumenComuna();

  if (resumenQuery.isLoading) {
    // Misma estructura de CardHeader + CardTitle + CardContent que la tarjeta
    // real (título + valor grande + hint) — reserva la misma altura para que
    // nada de lo que está debajo salte al llegar los datos (CLS).
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-20" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (resumenQuery.isError) {
    return (
      <p className="text-sm text-critical">
        No se pudieron cargar los KPIs: {(resumenQuery.error as Error).message}
      </p>
    );
  }

  if (!resumenQuery.data) return null;

  const comunas = resumenQuery.data;
  const conPm25 = comunas.filter((c) => c.pm25_promedio != null);
  // Promedio simple entre comunas (no ponderado por población ni por número
  // de lecturas): es la definición más directa de "PM2.5 promedio ciudad" a
  // partir de datos ya agregados por comuna, y coincide con el sanity check
  // manual que pide la fase (promedio simple de las comunas).
  const pm25PromedioCiudad =
    conPm25.length > 0
      ? conPm25.reduce((acc, c) => acc + (c.pm25_promedio ?? 0), 0) / conPm25.length
      : null;

  const conRatio = comunas.filter((c) => c.ratio_mitigadores != null);
  const coberturaMitigadoraPromedio =
    conRatio.length > 0
      ? conRatio.reduce((acc, c) => acc + (c.ratio_mitigadores ?? 0), 0) / conRatio.length
      : null;

  const totalArbolesRecomendados = comunas.reduce(
    (acc, c) => acc + c.arboles_a_plantar_total,
    0,
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="PM2.5 promedio ciudad"
        value={pm25PromedioCiudad != null ? `${pm25PromedioCiudad.toFixed(1)} µg/m³` : "Sin dato"}
        hint={`Promedio simple entre ${conPm25.length} comunas con lectura`}
      />
      <KpiCard
        label="Cobertura arbórea mitigadora"
        value={
          coberturaMitigadoraPromedio != null
            ? `${coberturaMitigadoraPromedio.toFixed(1)}%`
            : "Sin dato"
        }
        hint="% de árboles que son especies mitigadoras de PM2.5, promedio entre comunas"
      />
      <KpiCard
        label="Comunas priorizadas"
        value={String(comunas.length)}
        hint="Con al menos una zona verde apta para siembra"
      />
      <KpiCard
        label="Árboles recomendados"
        value={totalArbolesRecomendados.toLocaleString("es-CO")}
        hint="Total de individuos a sembrar en zonas priorizadas"
      />
    </div>
  );
}
