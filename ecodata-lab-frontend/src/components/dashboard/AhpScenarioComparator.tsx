"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { PESOS_AHP_ORIGINALES, type PesosAhp } from "@/types/rankingComuna";

type PesoKey = keyof PesosAhp;

const CAMPOS: { key: PesoKey; label: string; color: string }[] = [
  { key: "pesoPm25", label: "PM2.5 (contaminación)", color: "var(--color-critical)" },
  { key: "pesoDeficit", label: "Déficit de mitigadores", color: "var(--color-warning)" },
  { key: "pesoArea", label: "Área disponible", color: "var(--color-vegetation)" },
];

/**
 * Mueve `key` a `nuevoValor` y reajusta los otros dos pesos proporcionalmente
 * para que la suma se mantenga en 1.0 — el segundo se deriva por resta del
 * remanente en vez de redondearse de forma independiente, así la suma queda
 * exacta en punto flotante (el backend valida con tolerancia 1e-6, no admite
 * redondeos sueltos que se salgan de ese margen).
 */
function reajustarPesos(actual: PesosAhp, key: PesoKey, nuevoValor: number): PesosAhp {
  const clamped = Math.min(1, Math.max(0, nuevoValor));
  const otras = CAMPOS.map((c) => c.key).filter((k) => k !== key) as [PesoKey, PesoKey];
  const [k1, k2] = otras;
  const sumaOtras = actual[k1] + actual[k2];
  const remanente = 1 - clamped;

  let v1: number;
  let v2: number;
  if (sumaOtras <= 0) {
    v1 = remanente / 2;
    v2 = remanente - v1;
  } else {
    v1 = (actual[k1] / sumaOtras) * remanente;
    v2 = remanente - v1;
  }

  return { ...actual, [key]: clamped, [k1]: v1, [k2]: v2 } as PesosAhp;
}

export function AhpScenarioComparator({
  pesos,
  onChange,
}: {
  pesos: PesosAhp;
  onChange: (pesos: PesosAhp) => void;
}) {
  const esOriginal =
    Math.abs(pesos.pesoPm25 - PESOS_AHP_ORIGINALES.pesoPm25) < 1e-6 &&
    Math.abs(pesos.pesoDeficit - PESOS_AHP_ORIGINALES.pesoDeficit) < 1e-6 &&
    Math.abs(pesos.pesoArea - PESOS_AHP_ORIGINALES.pesoArea) < 1e-6;

  return (
    <div className="space-y-5">
      {CAMPOS.map(({ key, label, color }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              {label}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {(pesos[key] * 100).toFixed(0)}%
            </span>
          </div>
          <Slider
            value={[pesos[key]]}
            min={0}
            max={1}
            step={0.01}
            onValueChange={([v]) => onChange(reajustarPesos(pesos, key, v))}
            aria-label={label}
            getValueLabel={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange(PESOS_AHP_ORIGINALES)}
        disabled={esOriginal}
      >
        <ArrowCounterClockwiseIcon size={16} />
        Restaurar pesos originales (45/35/20)
      </Button>
    </div>
  );
}
