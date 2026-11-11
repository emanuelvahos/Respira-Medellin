"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Pesos reales del modelo AHP simplificado (Saaty, 1980), tal como están
 * fijados en `bloque2_recomendador_siembra.py` (W_PM25/W_DEF/W_AREA) — no
 * son una cifra inventada para la landing. */
// Clases estáticas y literales (Tailwind v4 escanea el código fuente, no
// puede resolver clases construidas dinámicamente vía template strings).
const CRITERIA = [
  {
    label: "PM2.5 (salud pública)",
    weight: 0.45,
    bgClass: "bg-critical",
    dotClass: "bg-critical",
  },
  {
    label: "Déficit de mitigadores",
    weight: 0.35,
    bgClass: "bg-warning",
    dotClass: "bg-warning",
  },
  {
    label: "Área disponible",
    weight: 0.2,
    bgClass: "bg-vegetation",
    dotClass: "bg-vegetation",
  },
] as const;

export function AHPBalanceBar() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="w-full max-w-xl">
      <div className="flex h-10 w-full overflow-hidden rounded-full border border-border">
        {CRITERIA.map((c) => (
          <motion.div
            key={c.label}
            className={`h-full ${c.bgClass}`}
            initial={{ width: 0 }}
            whileInView={{ width: `${c.weight * 100}%` }}
            viewport={{ once: true, amount: 0.6 }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.9, ease: "easeOut" }
            }
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {CRITERIA.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            <span
              className={`inline-block size-2.5 rounded-full ${c.dotClass}`}
              aria-hidden="true"
            />
            <span className="text-foreground">
              {(c.weight * 100).toFixed(0)}% — {c.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
