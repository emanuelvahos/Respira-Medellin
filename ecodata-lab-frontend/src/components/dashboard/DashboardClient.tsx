"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MainContainer } from "@/components/layout/MainContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { Pm25BarChart } from "@/components/dashboard/Pm25BarChart";
import { Pm25TrendChart } from "@/components/dashboard/Pm25TrendChart";
import { ComunasTable } from "@/components/dashboard/ComunasTable";
import { ArbolesSauStats } from "@/components/dashboard/ArbolesSauStats";
import { SaludRespiratoriaBarChart } from "@/components/dashboard/SaludRespiratoriaBarChart";
import { Pm25SaludComparacion } from "@/components/dashboard/Pm25SaludComparacion";
import { AhpScenarioComparator } from "@/components/dashboard/AhpScenarioComparator";
import { ComunaComparator } from "@/components/dashboard/ComunaComparator";
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

      <ComunaComparator />

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

export function DashboardClient() {
  // `useSearchParams` (dentro de DashboardInner) requiere un límite
  // Suspense explícito: sin él, Next.js falla el build estático de esta
  // ruta ("useSearchParams() should be wrapped in a suspense boundary").
  return (
    <Suspense
      fallback={
        <MainContainer className="py-8">
          <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
        </MainContainer>
      }
    >
      <DashboardInner />
    </Suspense>
  );
}
