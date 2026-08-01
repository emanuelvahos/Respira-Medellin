export function MapLegend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 w-64 rounded-lg border border-border bg-card/95 p-4 text-xs text-card-foreground shadow-md backdrop-blur">
      <p className="mb-2 font-heading text-sm font-semibold">Leyenda</p>

      <div className="mb-3">
        <p className="mb-1 font-medium text-muted-foreground">
          Comunas · prioridad AHP (color y altura)
        </p>
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-vegetation via-warning to-critical" />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Baja</span>
          <span>Alta</span>
        </div>
      </div>

      <div className="mb-3">
        <p className="mb-1 font-medium text-muted-foreground">
          Partículas PM2.5 (estaciones SIATA reales)
        </p>
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-data-sky via-warning to-critical" />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Bajo</span>
          <span>Alto</span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Más densidad y velocidad de flujo = mayor concentración real en esa estación.
        </p>
      </div>

      <div>
        <p className="mb-1 font-medium text-muted-foreground">
          Árboles 3D (al seleccionar una comuna)
        </p>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-vegetation" aria-hidden="true" />
            Existentes (muestra)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-chart-2" aria-hidden="true" />
            Zonas recomendadas
          </span>
        </div>
      </div>
    </div>
  );
}
