"use client";

import { useState } from "react";
import { useZonaAptitud } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import type { ZonaAptitud } from "@/types/aptitud";

const ETIQUETA: Record<ZonaAptitud["aptitud"], { texto: string; clases: string }> = {
  apta: { texto: "Apta", clases: "border-vegetation/40 bg-vegetation-muted text-vegetation" },
  apta_con_condiciones: {
    texto: "Apta con condiciones",
    clases: "border-warning/50 bg-warning/10 text-warning-foreground",
  },
  no_apta: { texto: "No apta", clases: "border-critical/40 bg-critical/10 text-critical" },
};

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Nivel 1 (aptitud de la zona) y, si el backend lo habilita, aviso del nivel 2 (puntos indicativos). */
export function AptitudTerrenoBloque({ idPoligono }: { idPoligono: number }) {
  const q = useZonaAptitud(idPoligono);
  const [detalle, setDetalle] = useState(false);
  const a = q.data;

  if (q.isLoading) return <p className="mt-3 text-xs text-muted-foreground">Analizando terreno…</p>;
  if (q.isError || !a) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        No hay análisis de terreno disponible para esta zona.
      </p>
    );
  }
  const e = ETIQUETA[a.aptitud];
  const m = a.metricas;
  const filas: [string, string][] = [];
  if (m.pendiente_media_grados != null)
    filas.push(["Pendiente media", `${m.pendiente_media_grados.toFixed(1)}°`]);
  if (m.fraccion_amenaza_mov_masa_alta > 0)
    filas.push(["Amenaza alta por movimiento en masa", pct(m.fraccion_amenaza_mov_masa_alta)]);
  if (m.fraccion_amenaza_inundacion_alta > 0)
    filas.push(["Amenaza alta por inundación", pct(m.fraccion_amenaza_inundacion_alta)]);
  if (m.fraccion_amenaza_torrencial_alta > 0)
    filas.push(["Amenaza alta por avenida torrencial", pct(m.fraccion_amenaza_torrencial_alta)]);
  if (m.fraccion_riesgo_no_mitigable > 0)
    filas.push(["Riesgo alto no mitigable", pct(m.fraccion_riesgo_no_mitigable)]);
  if (m.fraccion_retiro_quebrada > 0) filas.push(["En retiro a quebrada", pct(m.fraccion_retiro_quebrada)]);
  if (m.fraccion_franja_tension > 0)
    filas.push(["Bajo franja de línea de tensión", pct(m.fraccion_franja_tension)]);
  if (m.anden_ancho_m != null) filas.push(["Ancho de andén cercano", `${m.anden_ancho_m.toFixed(1)} m`]);
  if (m.redes_cercanas.length > 0)
    filas.push(["Redes cercanas (2014)", m.redes_cercanas.join(", ").toLowerCase()]);

  return (
    <section className="mt-3 border-t border-border pt-3" aria-label="Aptitud del terreno">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Aptitud del terreno</p>
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", e.clases)}>{e.texto}</span>
      </div>

      {a.motivos_no_apta.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-foreground">
          {a.motivos_no_apta.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {a.condiciones.length > 0 && (
        <div className="mt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Condiciones antes de sembrar</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-foreground">
            {a.condiciones.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {a.aptitud === "apta" && (
        <p className="mt-2 text-xs text-foreground">
          No se detectó ninguna restricción en las capas consultadas. Sigue siendo necesaria la visita técnica.
        </p>
      )}

      {a.puntos_publicos && a.aptitud !== "no_apta" && (
        <p className="mt-2 rounded-md border border-border bg-secondary p-2 text-xs text-foreground">
          <strong>{a.puntos_indicativos}</strong> puntos indicativos de siembra
          {a.cupo_estimado_previo != null && <> (el cupo por área era {a.cupo_estimado_previo})</>}. Son una
          propuesta de ubicación <strong>sujeta a visita técnica y concepto de EPM</strong>, no un diseño de obra.
        </p>
      )}

      <button
        type="button"
        onClick={() => setDetalle((v) => !v)}
        aria-expanded={detalle}
        className="mt-2 flex w-full items-center justify-between text-xs font-medium text-vegetation hover:underline"
      >
        <span>Ver datos, criterio y límites</span>
        <span aria-hidden="true">{detalle ? "−" : "+"}</span>
      </button>
      {detalle && (
        <div className="mt-2 space-y-3 text-xs">
          {filas.length > 0 && (
            <dl className="space-y-1">
              {filas.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {a.razones_especie.length > 0 && (
            <div>
              <p className="font-medium text-muted-foreground">Por qué esta especie</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-foreground">
                {a.razones_especie.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="font-medium text-muted-foreground">Límites de este análisis</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              {a.avisos.map((t) => (
                <li key={t}>{t}</li>
              ))}
              <li>Consulta a las capas de la Alcaldía: {a.fecha_consulta}.</li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
