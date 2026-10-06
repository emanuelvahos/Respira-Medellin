"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAhpV2, useArbolesBalance, useCalidadDatos } from "@/lib/api/queries";

const fmt = (n: number) => n.toLocaleString("es-CO");

/** "Qué dice el dato" en tres frases, con la fecha de corte visible y enlace al panel de calidad. */
export function ResumenEjecutivo() {
  const balance = useArbolesBalance();
  const ahp = useAhpV2();
  const calidad = useCalidadDatos();

  if (balance.isLoading || ahp.isLoading || calidad.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2">
          <Skeleton className="h-5 w-full max-w-2xl" />
          <Skeleton className="h-5 w-full max-w-xl" />
          <Skeleton className="h-5 w-full max-w-2xl" />
        </CardContent>
      </Card>
    );
  }
  if (!balance.data || !ahp.data) return null;

  const top = ahp.data.filter((c) => c.rank_v2_15 === 1)[0];
  const sinPm25 = ahp.data.filter((c) => c.score_v2_15 == null).length;
  const pm25 = calidad.data?.fuentes.find((f) => f.id === "pm25_estaciones");
  const corteSau = balance.data.fecha_actualizacion_max_fuente;

  return (
    <Card>
      <CardContent>
        <h2 className="font-heading text-base font-semibold">Qué dice el dato</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>
            Medellín tiene <strong>{fmt(balance.data.totales.vivos)}</strong> árboles vivos registrados en el
            inventario oficial (SAU{corteSau ? `, corte ${corteSau}` : ""}).
          </li>
          {top && (
            <li>
              La comuna con mayor prioridad de siembra es <strong>{top.comuna}</strong> (puntaje{" "}
              {top.score_v2_15?.toFixed(2)} de 1,00), según PM2.5, déficit de especies mitigadoras y área apta.
            </li>
          )}
          <li>
            {sinPm25} de {ahp.data.length} comunas no tienen dato de PM2.5 y no se les calcula prioridad.
            {pm25?.fecha_corte ? ` El PM2.5 llega hasta ${pm25.fecha_corte}.` : ""}{" "}
            <a href="#calidad-datos" className="underline underline-offset-4">
              Ver calidad de los datos
            </a>
            .
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
