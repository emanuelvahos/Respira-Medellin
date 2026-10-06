const SECCIONES = [
  { id: "resumen", label: "Resumen" },
  { id: "arboles", label: "Árboles" },
  { id: "prioridad", label: "Prioridad" },
  { id: "evidencia", label: "Evidencia" },
  { id: "proyeccion", label: "Proyección" },
  { id: "calidad-datos", label: "Calidad de datos" },
] as const;

/** Índice de secciones: fijo bajo el header en escritorio, desplazable en móvil. */
export function SeccionesIndice() {
  return (
    <nav
      aria-label="Secciones del dashboard"
      className="z-30 -mx-4 border-b border-border bg-background/95 px-4 lg:sticky lg:top-16"
    >
      <ul className="flex gap-1 overflow-x-auto">
        {SECCIONES.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
