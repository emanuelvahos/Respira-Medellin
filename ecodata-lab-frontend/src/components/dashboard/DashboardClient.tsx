"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MainContainer } from "@/components/layout/MainContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { Pm25BarChart } from "@/components/dashboard/Pm25BarChart";
import { Pm25TrendChart } from "@/components/dashboard/Pm25TrendChart";
import { ComunasTable } from "@/components/dashboard/ComunasTable";
import { ArbolesPorComuna } from "@/components/dashboard/ArbolesPorComuna";
import { AhpV2Comparison } from "@/components/dashboard/AhpV2Comparison";
import { ArbolesSauStats } from "@/components/dashboard/ArbolesSauStats";
import { SaludRespiratoriaBarChart } from "@/components/dashboard/SaludRespiratoriaBarChart";
import { Pm25SaludComparacion } from "@/components/dashboard/Pm25SaludComparacion";
import { AhpScenarioComparator } from "@/components/dashboard/AhpScenarioComparator";
import { ComunaComparator } from "@/components/dashboard/ComunaComparator";
import { ProyeccionTemporal } from "@/components/dashboard/ProyeccionTemporal";
import { RankingScoreChart } from "@/components/dashboard/RankingScoreChart";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import {
  PESOS_AHP_ORIGINALES,
  pesosFromSearchParams,
  pesosToSearchParamsEntries,
  type PesosAhp,
} from "@/types/rankingComuna";

function DashboardInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Lazy initializer: lee los pesos de la URL en el primer render (vista
  // compartible), no vía un efecto posterior — evita el parpadeo de
  // "pesos originales -> luego salta a los del link" que vería quien abre
  // un link compartido con un escenario custom.
  const [pesos, setPesos] = useState<PesosAhp>(
    () => pesosFromSearchParams(searchParams) ?? PESOS_AHP_ORIGINALES,
  );

  function handlePesosChange(nuevosPesos: PesosAhp) {
    setPesos(nuevosPesos);
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of pesosToSearchParamsEntries(nuevosPesos)) {
      params.set(key, value);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <MainContainer className="space-y-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Dashboard analítico
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Explora los datos detrás de la priorización de siembra: indicadores
            generales, PM2.5 por comuna, y un comparador para cuestionar los
            pesos del modelo AHP (0.45 PM2.5 / 0.35 déficit / 0.20 área) que
            hasta ahora estaban fijados sin análisis de sensibilidad.
          </p>
        </div>
        <CopyLinkButton label="Copiar link de este escenario" />
      </div>

      <KpiCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Pm25BarChart />
        <Pm25TrendChart />
      </div>

      <ArbolesSauStats />

      <SaludRespiratoriaBarChart />
      <Pm25SaludComparacion />

      <Card>
        <CardHeader>
          <CardTitle>Comparador de escenarios AHP</CardTitle>
          <CardDescription>
            Mueve los pesos para ver cómo cambiaría la priorización de
            comunas si la Secretaría decidiera darle más peso a un criterio
            distinto. Los otros dos pesos se reajustan automáticamente para
            mantener la suma en 100%. Exporta el ranking resultante a PDF o
            Excel, o copia el link para compartir este escenario exacto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <AhpScenarioComparator pesos={pesos} onChange={handlePesosChange} />
          <RankingScoreChart pesos={pesos} />
        </CardContent>
      </Card>

      <ArbolesPorComuna />

      <AhpV2Comparison />

      <ComunaComparator />

      <ProyeccionTemporal />

      <Card>
        <CardHeader>
          <CardTitle>Comunas priorizadas</CardTitle>
          <CardDescription>
            Ordena por cualquier columna o busca una comuna. La columna
            &quot;Cambio&quot; compara la posición actual contra los pesos
            originales del pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComunasTable pesos={pesos} />
        </CardContent>
      </Card>
    </MainContainer>
  );
}

/**
 * Fallback del límite Suspense de nivel de página (ver `DashboardClient`
 * abajo) — reproduce la forma general del dashboard real (KPIs, gráficas,
 * tarjetas), no un simple texto de una línea.
 *
 * Investigación real (docs/ESTADO_PROYECTO.md, "Corregir CLS del footer en
 * /dashboard"): dar skeleton propio a cada componente individual (KpiCards,
 * ArbolesSauStats, etc.) NO cambió el CLS medido en absoluto — porque
 * ninguno de esos skeletons llegaba a pintarse antes de este salto. El
 * fallback de este Suspense de nivel superior era literalmente un solo
 * `<p>` de una línea: cuando `useSearchParams()` resolvía, TODO el
 * contenido del dashboard (~6.845px de alto en el viewport móvil que usa
 * Lighthouse) aparecía de golpe en un único salto — el footer entero
 * saltando de golpe era ese evento, no la suma de los saltos pequeños por
 * componente. Este esqueleto de página completa es el fix real.
 */
function DashboardPageSkeleton() {
  return (
    <MainContainer className="space-y-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-3/4 max-w-2xl" />
        </div>
        <Skeleton className="h-9 w-40 shrink-0" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-72 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-72" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-56 w-full" />
          </CardContent>
        </Card>
      ))}
    </MainContainer>
  );
}

export function DashboardClient() {
  // `useSearchParams` (dentro de DashboardInner) requiere un límite
  // Suspense explícito: sin él, Next.js falla el build estático de esta
  // ruta ("useSearchParams() should be wrapped in a suspense boundary").
  return (
    <Suspense fallback={<DashboardPageSkeleton />}>
      <DashboardInner />
    </Suspense>
  );
}
