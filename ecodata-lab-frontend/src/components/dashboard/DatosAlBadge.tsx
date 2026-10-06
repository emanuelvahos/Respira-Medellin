"use client";

import { useCalidadDatos } from "@/lib/api/queries";

/** Insignia "Datos al": fechas de corte de las dos fuentes principales; enlaza al panel de calidad. */
export function DatosAlBadge() {
  const q = useCalidadDatos();
  const f = (id: string) => q.data?.fuentes.find((x) => x.id === id)?.fecha_corte ?? null;
  const sau = f("sau");
  const pm = f("pm25_estaciones");
  return (
    <a
      href="#calidad-datos"
      className="mt-2 inline-flex min-h-8 items-center rounded-full border border-border bg-card px-3 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {q.data ? `Datos al: árboles ${sau ?? "s/f"} · PM2.5 ${pm ?? "s/f"}. Ver calidad de datos` : "Datos al: cargando…"}
    </a>
  );
}
