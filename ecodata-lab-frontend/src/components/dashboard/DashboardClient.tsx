"use client";

import { useState } from "react";
import { MainContainer } from "@/components/layout/MainContainer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { Pm25BarChart } from "@/components/dashboard/Pm25BarChart";
import { Pm25TrendChart } from "@/components/dashboard/Pm25TrendChart";
import { ComunasTable } from "@/components/dashboard/ComunasTable";
import { AhpScenarioComparator } from "@/components/dashboard/AhpScenarioComparator";
import { RankingScoreChart } from "@/components/dashboard/RankingScoreChart";
import { PESOS_AHP_ORIGINALES, type PesosAhp } from "@/types/rankingComuna";

export function DashboardClient() {
  const [pesos, setPesos] = useState<PesosAhp>(PESOS_AHP_ORIGINALES);

  return (
    <MainContainer className="space-y-8 py-8">
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

      <KpiCards />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Pm25BarChart />
        <Pm25TrendChart />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparador de escenarios AHP</CardTitle>
          <CardDescription>
            Mueve los pesos para ver cómo cambiaría la priorización de
            comunas si la Secretaría decidiera darle más peso a un criterio
            distinto. Los otros dos pesos se reajustan automáticamente para
            mantener la suma en 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
          <AhpScenarioComparator pesos={pesos} onChange={setPesos} />
          <RankingScoreChart pesos={pesos} />
        </CardContent>
      </Card>

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
