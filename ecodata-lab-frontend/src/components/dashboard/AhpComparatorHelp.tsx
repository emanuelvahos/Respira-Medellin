"use client";

import { useState } from "react";
import { QuestionIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Explicación en lenguaje simple del comparador de escenarios AHP, pensada
 * para alguien de la Secretaría que abre `/dashboard` sin el contexto de
 * cómo se construyó el modelo. Colapsada por defecto (el comparador ya
 * tiene `CardDescription` con un resumen de una línea en `DashboardClient`)
 * para no ocupar espacio permanente — mismo patrón de disclosure "+/-" ya
 * usado en `ZonaSiembraDetailPanel` ("Ver propuesta de diversificación").
 */
export function AhpComparatorHelp() {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="rounded-md border border-border bg-muted/30">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-foreground hover:text-vegetation"
      >
        <QuestionIcon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        ¿Cómo funciona este comparador?
        <span className="ml-auto text-muted-foreground" aria-hidden="true">
          {abierto ? "−" : "+"}
        </span>
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-border px-3 py-3 text-xs text-foreground">
          <div>
            <p className="font-medium">Los 3 criterios que se comparan</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>
                <strong className="text-foreground">PM2.5 (contaminación):</strong> qué tan
                contaminada está el aire de la comuna — a más contaminación, más urgente
                sembrar árboles ahí.
              </li>
              <li>
                <strong className="text-foreground">Déficit de mitigadores:</strong> qué tan
                pocos árboles tiene la comuna hoy en relación a lo que necesitaría — una comuna
                con pocos árboles y mucha gente tiene un déficit alto.
              </li>
              <li>
                <strong className="text-foreground">Área disponible:</strong> cuánto espacio real
                (parques, separadores, antejardines, etc., según el inventario de GeoMedellín)
                hay disponible para sembrar en esa comuna — de nada sirve priorizar una comuna
                sin sitio físico donde plantar.
              </li>
            </ul>
          </div>

          <div>
            <p className="font-medium">Los pesos siempre suman 100%</p>
            <p className="mt-1 text-muted-foreground">
              Cada criterio tiene un &quot;peso&quot; (cuánto influye en el ranking final). Los tres
              siempre suman 100%: si subes el peso de uno con el control deslizante, los otros
              dos bajan automáticamente en proporción para que la suma no cambie.
            </p>
          </div>

          <div>
            <p className="font-medium">Es una herramienta para explorar, no para decidir</p>
            <p className="mt-1 text-muted-foreground">
              Mover los sliders recalcula el ranking de comunas <strong>en vivo</strong>, solo en
              tu pantalla — es una forma de preguntar &quot;¿qué pasaría si priorizáramos
              distinto?&quot;. No cambia el modelo oficial: los pesos originales del pipeline de
              recomendación (45% PM2.5 / 35% déficit / 20% área) siguen siendo esos salvo que
              alguien los cambie deliberadamente en el código.
            </p>
          </div>

          <div>
            <p className="font-medium">Ejemplo</p>
            <p className="mt-1 text-muted-foreground">
              Si subes el peso de PM2.5, las comunas más contaminadas suben en el ranking —
              incluso si tienen poco espacio disponible para sembrar, porque ese criterio ahora
              pesa menos que antes en la fórmula. El botón &quot;Restaurar pesos originales&quot;
              vuelve al escenario oficial en cualquier momento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
