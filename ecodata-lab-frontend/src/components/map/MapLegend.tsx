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
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="inline-block size-2.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
          Gris plano: sin dato de PM2.5, sin score AHP calculado
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full border-2 border-foreground bg-warning/40"
            aria-hidden="true"
          />
          Relleno translúcido + borde grueso: score AHP calculado, pero{" "}
          <strong className="font-medium text-foreground">
            sin zona de siembra viable identificada
          </strong>{" "}
          en el inventario real de zonas verdes (Santa Cruz, Villa Hermosa,
          San Cristóbal, Santa Elena)
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full border-2 border-dotted border-critical bg-warning/40"
            aria-hidden="true"
          />
          Borde punteado (rojo): PM2.5{" "}
          <strong className="font-medium text-foreground">
            estimado por interpolación espacial (IDW), NO medido
          </strong>{" "}
          — ninguna estación SIATA real dentro de la comuna (Popular,
          Manrique, Doce de Octubre). Confianza media; ver panel de detalle.
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-data-sky bg-warning/40 text-[8px]" aria-hidden="true">
            ⏱
          </span>
          Ícono de reloj + borde sólido azul: PM2.5{" "}
          <strong className="font-medium text-foreground">
            real pero histórico, NO vigente
          </strong>{" "}
          — estación MED-ALTA2 (Altavista, Corantioquia/SISAIRE) inactiva
          desde 2025-09-25. Dato real, pero no representa las condiciones
          actuales; ver panel de detalle.
        </p>
      </div>

      <div className="mb-3">
        <p className="mb-1 font-medium text-muted-foreground">
          Zonas priorizadas de siembra
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span
            className="inline-block size-2.5 shrink-0 rounded-full border-2 border-critical bg-warning/40"
            aria-hidden="true"
          />
          Borde rojo grueso:{" "}
          <strong className="font-medium text-foreground">
            posible falso positivo
          </strong>{" "}
          — se solapa con cancha/plaza/unidad deportiva según el inventario
          real de GeoMedellín (auditoría Fase D). Desde la Fase E1{" "}
          <strong className="font-medium text-foreground">
            estas zonas ya no aparecen por defecto
          </strong>{" "}
          en la recomendación activa — decisión explícita del equipo del
          proyecto, no un cambio automático. Actívalas con &ldquo;Mostrar
          zonas descartadas (auditoría)&rdquo; en el panel de Capas; una vez
          visibles, click para ver el motivo y un atajo a vista satelital.
        </p>
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

      <div className="mb-3">
        <p className="mb-1 font-medium text-muted-foreground">
          Zonas verdes · cobertura dominante (inventario GeoMedellín)
        </p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-vegetation" aria-hidden="true" />
            Árboles
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-chart-1" aria-hidden="true" />
            Grama
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-chart-2" aria-hidden="true" />
            Jardín
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-chart-3" aria-hidden="true" />
            Arbustos
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-earth" aria-hidden="true" />
            Tierra
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 shrink-0 rounded-full bg-chart-5" aria-hidden="true" />
            Piso duro
          </span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Capa apagada por defecto (48.348 polígonos): actívala desde el panel de capas.
        </p>
      </div>

      <div>
        <p className="mb-1 font-medium text-muted-foreground">
          Árboles del SAU · dos modos (selector arriba a la derecha)
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          <strong className="font-medium text-foreground">Por comuna</strong>{" "}
          (default): conos 3D solo al seleccionar una comuna.
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-vegetation" aria-hidden="true" />
            Existentes (ubicaciones reales SAU)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block size-2.5 rounded-full bg-chart-2" aria-hidden="true" />
            Zonas recomendadas (aproximado)
          </span>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Verde: árbol real del censo SAU, muestra acotada por rendimiento.
          Dorado: centroide de una zona priorizada para sembrar — todavía no
          es un árbol plantado. Pasa el mouse sobre un árbol verde para ver
          su especie real.
        </p>
        <p className="mt-2 text-[10px] text-muted-foreground">
          <strong className="font-medium text-foreground">Ciudad completa</strong>:
          clusters/puntos del inventario SAU en todo Medellín, sin necesidad
          de seleccionar comuna. Puede ser más lento al hacer zoom. Los dos
          modos son excluyentes — activar uno oculta el otro para no mezclar
          representaciones del mismo inventario.
        </p>
      </div>
    </div>
  );
}
