"use client";

import { useState } from "react";
import { ArrowCounterClockwiseIcon, FilePdfIcon, FileXlsIcon } from "@phosphor-icons/react/dist/ssr";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { PESOS_AHP_ORIGINALES, type PesosAhp } from "@/types/rankingComuna";
import { rankingComunasExportUrl } from "@/lib/api/endpoints";
import { apiFetchBlob, ApiError } from "@/lib/api/client";
import { reajustarPesos } from "@/lib/dashboard/reajustarPesos";
import { AhpComparatorHelp } from "@/components/dashboard/AhpComparatorHelp";

type PesoKey = keyof PesosAhp;

const CAMPOS: { key: PesoKey; label: string; color: string }[] = [
  { key: "pesoPm25", label: "PM2.5 (contaminación)", color: "var(--color-critical)" },
  { key: "pesoDeficit", label: "Déficit de mitigadores", color: "var(--color-warning)" },
  { key: "pesoArea", label: "Área disponible", color: "var(--color-vegetation)" },
];

type FormatoExport = "pdf" | "excel";

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

  const [exportando, setExportando] = useState<FormatoExport | null>(null);
  const [errorExport, setErrorExport] = useState<string | null>(null);

  async function handleExport(formato: FormatoExport) {
    setExportando(formato);
    setErrorExport(null);
    try {
      // `pesos` es el estado ACTUAL de los sliders en pantalla, no un
      // default: el archivo exportado siempre refleja el escenario que la
      // persona está viendo en ese momento.
      const { blob, filename } = await apiFetchBlob(rankingComunasExportUrl(pesos, formato));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? `ranking-siembra-medellin.${formato === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorExport(
        err instanceof ApiError
          ? `No se pudo generar el archivo: ${err.message}`
          : "No se pudo generar el archivo: error inesperado.",
      );
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="space-y-5">
      <AhpComparatorHelp />

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

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("pdf")}
          disabled={exportando !== null}
        >
          <FilePdfIcon size={16} />
          {exportando === "pdf" ? "Generando…" : "Exportar PDF"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("excel")}
          disabled={exportando !== null}
        >
          <FileXlsIcon size={16} />
          {exportando === "excel" ? "Generando…" : "Exportar Excel"}
        </Button>
      </div>
      {errorExport && <p className="text-xs text-critical">{errorExport}</p>}
    </div>
  );
}
