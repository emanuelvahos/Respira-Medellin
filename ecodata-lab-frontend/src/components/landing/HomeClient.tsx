"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import {
  ClockCountdownIcon,
  ArrowRightIcon,
  LeafIcon,
} from "@phosphor-icons/react/dist/ssr";
import { ScrollSection } from "@/components/landing/ScrollSection";
import { ScrollMapSync } from "@/components/landing/ScrollMapSync";
import { AHPBalanceBar } from "@/components/landing/AHPBalanceBar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useComunas, useResumenComuna } from "@/lib/api/queries";
import { useMapStore, INITIAL_VIEW_STATE, type MapViewState } from "@/store/mapStore";
import { normalizeComunaName } from "@/lib/map/matchComuna";
import { approximateCentroid } from "@/lib/map/geoCentroid";

// El mapa depende de WebGL/`window`: no puede renderizarse en el servidor.
// Es el MISMO MapCanvas/mapStore de Fase 2 (no un mapa nuevo) — el scroll
// solo controla su `viewState` vía ScrollMapSync.
const MapCanvas = dynamic(
  () => import("@/components/map/MapCanvas").then((mod) => mod.MapCanvas),
  { ssr: false },
);

const FALLBACK_KEYFRAME: MapViewState = INITIAL_VIEW_STATE;

export function HomeClient() {
  const comunasQuery = useComunas();
  const resumenQuery = useResumenComuna();
  const setSelectedComuna = useMapStore((s) => s.setSelectedComuna);

  // Al salir de la landing, no dejar seleccionada ninguna comuna en el store
  // compartido (evita que /mapa abra con un panel ya abierto sin que el
  // usuario haya hecho clic).
  useEffect(() => {
    return () => setSelectedComuna(null);
  }, [setSelectedComuna]);

  const topPm25Comuna = useMemo(() => {
    if (!resumenQuery.data?.length) return null;
    return [...resumenQuery.data]
      .filter((r) => r.pm25_promedio != null)
      .sort((a, b) => (b.pm25_promedio ?? 0) - (a.pm25_promedio ?? 0))[0];
  }, [resumenQuery.data]);

  const topPriorityComuna = useMemo(() => {
    if (!resumenQuery.data?.length) return null;
    return [...resumenQuery.data].sort(
      (a, b) => b.score_multicriteria - a.score_multicriteria,
    )[0];
  }, [resumenQuery.data]);

  const topPriorityCentroid = useMemo(() => {
    if (!topPriorityComuna || !comunasQuery.data) return null;
    const feature = comunasQuery.data.features.find(
      (f) => normalizeComunaName(f.properties.nombre) === normalizeComunaName(topPriorityComuna.comuna),
    );
    return feature ? approximateCentroid(feature.geometry) : null;
  }, [topPriorityComuna, comunasQuery.data]);

  const keyframes: MapViewState[] = useMemo(() => {
    const wide: MapViewState = { longitude: -75.5812, latitude: 6.2442, zoom: 10.2, pitch: 20, bearing: 0 };
    const correlacion: MapViewState = { longitude: -75.57, latitude: 6.252, zoom: 11.6, pitch: 45, bearing: 15 };
    const metodologia: MapViewState = { longitude: -75.58, latitude: 6.244, zoom: 11, pitch: 55, bearing: -20 };
    const recomendacion: MapViewState = topPriorityCentroid
      ? { longitude: topPriorityCentroid[0], latitude: topPriorityCentroid[1], zoom: 13.5, pitch: 60, bearing: 10 }
      : FALLBACK_KEYFRAME;
    const cta: MapViewState = { ...wide, pitch: 35 };
    return [wide, correlacion, metodologia, recomendacion, cta];
  }, [topPriorityCentroid]);

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <MapCanvas />
        <div className="absolute inset-0 bg-background/55" />
      </div>

      <ScrollMapSync keyframes={keyframes} />

      <ScrollSection id="intro" className="justify-center">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <span className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-medium text-accent-foreground backdrop-blur">
            <ClockCountdownIcon size={16} weight="bold" aria-hidden="true" />
            Fase 3 · El problema
          </span>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl md:text-6xl">
            El aire de Medellín tiene un costo que no siempre se ve
          </h1>
          <p className="mt-6 text-pretty text-base text-muted-foreground sm:text-lg">
            El material particulado PM2.5 —partículas tan pequeñas que penetran
            profundo en el sistema respiratorio— se concentra de forma desigual
            entre comunas, mientras la cobertura arbórea, uno de sus mitigadores
            naturales, también varía mucho de un barrio a otro.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Sigue el recorrido: los datos reales de SIATA y el censo arbóreo de
            la ciudad guían la cámara del mapa de fondo.
          </p>
        </div>
      </ScrollSection>

      <ScrollSection id="correlacion" className="justify-center">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          <Card className="w-full bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="font-heading text-2xl">
                PM2.5 y cobertura arbórea no se distribuyen igual
              </CardTitle>
              <CardDescription>
                La exposición sostenida a PM2.5 está asociada en la literatura
                de salud ambiental con afectaciones respiratorias y
                cardiovasculares. Los árboles mitigadores ayudan a capturar
                parte de ese material particulado, pero su cobertura no
                siempre coincide con las zonas de mayor concentración.
              </CardDescription>
            </CardHeader>
            {topPm25Comuna && (
              <div className="px-6 pb-6">
                <p className="font-heading text-4xl font-semibold text-critical">
                  {topPm25Comuna.pm25_promedio?.toFixed(1)} µg/m³
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  PM2.5 promedio más alto entre comunas: {topPm25Comuna.comuna}{" "}
                  (dato real, <code className="rounded bg-secondary px-1 py-0.5 text-xs">/api/siembra/resumen-comuna</code>)
                </p>
              </div>
            )}
          </Card>
        </div>
      </ScrollSection>

      <ScrollSection id="metodologia-ahp" className="justify-center">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <h2 className="font-heading text-3xl font-semibold text-foreground">
            ¿Cómo se decide dónde sembrar?
          </h2>
          <p className="mt-4 max-w-xl text-pretty text-muted-foreground">
            Un modelo multicriterio ponderado (AHP simplificado, Saaty 1980)
            combina tres factores reales por comuna para calcular un score de
            prioridad de siembra:
          </p>
          <div className="mt-8">
            <AHPBalanceBar />
          </div>
        </div>
      </ScrollSection>

      <ScrollSection id="recomendacion" className="justify-center">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          <Card className="w-full bg-card/90 backdrop-blur">
            <CardHeader>
              <span
                className="mb-2 flex size-11 items-center justify-center rounded-lg bg-vegetation-muted text-vegetation"
                aria-hidden="true"
              >
                <LeafIcon size={22} weight="bold" />
              </span>
              <CardTitle className="font-heading text-2xl">
                La recomendación, aplicada
              </CardTitle>
              <CardDescription>
                {topPriorityComuna ? (
                  <>
                    <strong className="text-foreground">{topPriorityComuna.comuna}</strong>{" "}
                    encabeza el ranking de prioridad con un score de{" "}
                    <strong className="text-foreground">
                      {topPriorityComuna.score_multicriteria.toFixed(2)}
                    </strong>
                    : {topPriorityComuna.n_zonas_disponibles} zonas priorizadas
                    disponibles y {topPriorityComuna.arboles_a_plantar_total}{" "}
                    árboles recomendados, principalmente{" "}
                    {topPriorityComuna.especie_principal}.
                  </>
                ) : (
                  "Cargando la comuna de mayor prioridad…"
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </ScrollSection>

      <ScrollSection id="cta" className="justify-center">
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <h2 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">
            Explora el mapa completo
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Activa capas, compara comunas y navega libremente por los datos
            reales de arborización y calidad del aire de Medellín.
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link href="/mapa">
              Ir al mapa 3D
              <ArrowRightIcon size={18} weight="bold" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </ScrollSection>
    </div>
  );
}
