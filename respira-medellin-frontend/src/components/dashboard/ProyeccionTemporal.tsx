"use client";

import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { proyeccionMaduracionQueryOptions, useProyeccionMaduracion } from "@/lib/api/queries";
import {
  ESCENARIO_LABELS,
  ESCENARIOS_MADURACION,
  type EscenarioMaduracion,
} from "@/types/proyeccionMaduracion";
import { MethodologyNote } from "@/components/dashboard/MethodologyNote";

/**
 * Explorador de la curva de maduración estimada del plan de siembra (Fase
 * F4) — NUNCA presenta un valor de PM2.5 en µg/kg, solo un % (0-100) que
 * multiplica los datos reales ya existentes (`arboles_cupo_estimado`,
 * eficiencia cualitativa). Ver `backend/app/services/maduracion.py` para la
 * metodología completa; los 6 caveats de abajo vienen literalmente del
 * campo `caveats` de la respuesta del endpoint (viajan con el dato, no
 * están hardcodeados por duplicado en el frontend).
 */
export function ProyeccionTemporal() {
  const [escenario, setEscenario] = useState<EscenarioMaduracion>("esperado");
  const [anio, setAnio] = useState(0);

  // Metadata siempre disponible (cualquier (anio, escenario) trae el mapa
  // completo de años de maduración de los 3 escenarios, ver
  // `calcular_proyeccion` en el backend) — se usa solo para dimensionar el
  // slider, no depende de qué esté seleccionado en pantalla.
  const metaQuery = useProyeccionMaduracion(0, "esperado");
  const anioMaximo = useMemo(() => {
    const conservador = metaQuery.data?.anios_maduracion_por_escenario.conservador;
    if (!conservador) return 40;
    return Math.max(...Object.values(conservador));
  }, [metaQuery.data]);

  // Ajusta el año seleccionado si el usuario lo dejó más allá del máximo
  // del escenario actual (ej. venía de "conservador" a 35 años y cambia a
  // "optimista", cuyo máximo real es menor).
  const anioMaduracionEscenario = useMemo(() => {
    const mapa = metaQuery.data?.anios_maduracion_por_escenario[escenario];
    return mapa ? Math.max(...Object.values(mapa)) : anioMaximo;
  }, [metaQuery.data, escenario, anioMaximo]);

  const puntoQuery = useProyeccionMaduracion(anio, escenario);

  // Un punto por año (0..anioMaximo) para dibujar la curva completa del
  // escenario activo — reutiliza el mismo endpoint que el punto
  // seleccionado (nunca recalcula la fórmula en el cliente), cacheado
  // indefinidamente por año/escenario.
  const aniosCurva = useMemo(
    () => Array.from({ length: anioMaximo + 1 }, (_, i) => i),
    [anioMaximo],
  );
  const curvaResultados = useQueries({
    queries: aniosCurva.map((a) => proyeccionMaduracionQueryOptions(a, escenario)),
  });
  const curvaData = useMemo(
    () =>
      aniosCurva.map((a, i) => ({
        anio: a,
        porcentaje: curvaResultados[i]?.data
          ? Math.round(curvaResultados[i]!.data!.factor_promedio_ciudad * 1000) / 10
          : null,
      })),
    [aniosCurva, curvaResultados],
  );

  const cargando = metaQuery.isLoading || puntoQuery.isLoading;
  const porcentajeActual = puntoQuery.data
    ? Math.round(puntoQuery.data.factor_promedio_ciudad * 1000) / 10
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proyección temporal de maduración del plan de siembra</CardTitle>
        <CardDescription>
          Un árbol recién plantado no mitiga PM2.5 al nivel de un ejemplar adulto de inmediato.
          Mueve el año y el escenario para explorar cómo crecería el efecto estimado del plan de
          siembra recomendado — nunca un valor exacto de PM2.5, siempre un % de la capacidad de
          mitigación cualitativa ya documentada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex rounded-md border border-border p-0.5 text-xs w-fit">
          {ESCENARIOS_MADURACION.map((esc) => (
            <button
              key={esc}
              type="button"
              onClick={() => setEscenario(esc)}
              aria-pressed={escenario === esc}
              className={cn(
                "rounded px-3 py-1.5 font-medium",
                escenario === esc
                  ? "bg-vegetation-muted text-vegetation"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ESCENARIO_LABELS[esc]}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              Años desde la siembra: <span className="tabular-nums">{anio}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Madurez estimada de este escenario: ~{anioMaduracionEscenario} años
            </span>
          </div>
          <Slider
            value={[anio]}
            min={0}
            max={anioMaximo}
            step={1}
            onValueChange={([v]) => setAnio(v)}
            aria-label="Años desde la siembra"
            getValueLabel={(v) => `${v} años`}
          />
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <p className="text-xs text-muted-foreground">
              Capacidad de mitigación estimada alcanzada
            </p>
            <p className="font-heading text-4xl font-semibold text-vegetation tabular-nums">
              {cargando || porcentajeActual == null ? "…" : `${porcentajeActual.toFixed(1)}%`}
            </p>
          </div>
          {puntoQuery.data && (
            <p className="text-xs text-muted-foreground">
              Sobre {puntoQuery.data.arboles_cupo_estimado_total.toLocaleString("es-CO")} árboles
              recomendados en {puntoQuery.data.n_zonas.toLocaleString("es-CO")} zonas
              ({puntoQuery.data.n_zonas_con_diversificacion} con propuesta de diversificación de
              especies, Fase E3).
            </p>
          )}
        </div>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curvaData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="anio"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                label={{
                  value: "Años desde la siembra",
                  position: "insideBottom",
                  offset: -4,
                  fontSize: 11,
                  fill: "var(--color-muted-foreground)",
                }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                label={{
                  value: "% capacidad",
                  angle: -90,
                  position: "insideLeft",
                  fontSize: 11,
                  fill: "var(--color-muted-foreground)",
                }}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Capacidad estimada"]}
                labelFormatter={(label) => `Año ${label}`}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--color-foreground)" }}
                itemStyle={{ color: "var(--color-foreground)" }}
              />
              <Line
                type="monotone"
                dataKey="porcentaje"
                stroke="var(--color-vegetation)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              {porcentajeActual != null && (
                <ReferenceDot
                  x={anio}
                  y={porcentajeActual}
                  r={5}
                  fill="var(--color-vegetation)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {puntoQuery.data && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Factor por especie en el año {anio} ({ESCENARIO_LABELS[escenario].toLowerCase()})
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {puntoQuery.data.por_especie.map((e) => (
                <div
                  key={e.especie}
                  className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs"
                >
                  <span className="text-foreground">
                    {e.especie}{" "}
                    <span className="text-muted-foreground">({e.categoria_crecimiento})</span>
                  </span>
                  <span className="tabular-nums font-medium text-foreground">
                    {(e.factor * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Caveats SIEMPRE visibles, no en un tooltip/acordeón escondido:
            es la pieza de mayor incertidumbre metodológica del proyecto.
            El texto viene literalmente del campo `caveats` del endpoint —
            una sola fuente de verdad con el backend, ver
            `app/services/maduracion.py`. */}
        <MethodologyNote>
          <span className="mb-1 block font-medium text-foreground">
            Qué tan confiable es esta proyección
          </span>
          <ul className="list-disc space-y-1 pl-4">
            {(puntoQuery.data?.caveats ?? metaQuery.data?.caveats ?? []).map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </MethodologyNote>
      </CardContent>
    </Card>
  );
}
