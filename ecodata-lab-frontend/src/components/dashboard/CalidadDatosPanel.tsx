"use client";

import { CheckCircleIcon, WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCalidadDatos } from "@/lib/api/queries";

const ESTADO = {
  vigente: { texto: "Vigente", Icono: CheckCircleIcon, clase: "text-vegetation" },
  atencion: { texto: "Requiere atención", Icono: WarningCircleIcon, clase: "text-warning" },
  desactualizado: { texto: "Desactualizado", Icono: XCircleIcon, clase: "text-critical" },
  sin_fecha: { texto: "Sin fecha de corte", Icono: WarningCircleIcon, clase: "text-warning" },
} as const;

export function CalidadDatosPanel() {
  const q = useCalidadDatos();
  if (q.isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-72" />
          <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (q.isError || !q.data) {
    return <p className="text-sm text-critical">No se pudo cargar el panel de calidad de datos: {(q.error as Error | null)?.message ?? "sin datos"}</p>;
  }
  const r = q.data;
  return (
    <Card id="calidad-datos">
      <CardHeader>
        <CardTitle>Calidad y vigencia de los datos</CardTitle>
        <CardDescription>
          {r.resumen} Cada fuente muestra su fecha de corte real, qué tan vieja es frente a la frecuencia de
          actualización recomendada y sus limitaciones conocidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fuente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Corte</TableHead>
                <TableHead>Confianza</TableHead>
                <TableHead>Cobertura</TableHead>
                <TableHead>Limitaciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.fuentes.map((f) => {
                const e = ESTADO[f.estado];
                return (
                  <TableRow key={f.id} className="align-top">
                    <TableCell>
                      <div className="font-medium">{f.nombre}</div>
                      <div className="text-xs text-muted-foreground">{f.proveedor}</div>
                      <div className="text-xs text-muted-foreground">Se usa en: {f.usada_en}</div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 font-medium ${e.clase}`}>
                        <e.Icono aria-hidden size={14} /> {e.texto}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {f.fecha_corte ?? "No publicada"}
                      {f.antiguedad_dias != null && (
                        <div className="text-xs text-muted-foreground">hace {f.antiguedad_dias.toLocaleString("es-CO")} días</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{f.confianza}</TableCell>
                    <TableCell className="text-xs">{f.cobertura}</TableCell>
                    <TableCell className="min-w-64 text-xs">
                      <ul className="list-disc space-y-1 pl-4">
                        {f.limitaciones.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <section aria-label="Chequeos de integridad">
          <h3 className="mb-2 font-heading text-sm font-semibold">Chequeos automáticos de integridad</h3>
          <ul className="space-y-1 text-sm">
            {r.chequeos.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                {c.ok ? <CheckCircleIcon aria-hidden size={16} className="mt-0.5 text-vegetation" /> : <XCircleIcon aria-hidden size={16} className="mt-0.5 text-critical" />}
                <span>
                  <strong>{c.descripcion}</strong>: {c.ok ? "correcto" : "falla"}. <span className="text-muted-foreground">{c.detalle}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
