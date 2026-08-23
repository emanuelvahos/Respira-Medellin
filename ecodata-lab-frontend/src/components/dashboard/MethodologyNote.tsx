import { WarningIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Nota de advertencia metodológica, siempre visible junto al dato al que
 * aplica — no un tooltip escondido. Usa el token semántico `warning` ya
 * existente en el design system (ver AHPBalanceBar) en vez de un color nuevo.
 */
export function MethodologyNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground">
      <WarningIcon size={16} className="mt-0.5 shrink-0 text-warning" />
      {/* `div`, no `p`: algunos usos (ej. `ProyeccionTemporal`) pasan una
          lista <ul> como contenido, inválida dentro de un párrafo. */}
      <div>{children}</div>
    </div>
  );
}
