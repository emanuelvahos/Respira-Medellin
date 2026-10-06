"""Curva de maduración estimada del plan de siembra (Fase F4).

Contexto (ver docs/ESTADO_PROYECTO.md, entrada Fase F4, para la investigación
completa): un árbol recién plantado no mitiga PM2.5 de inmediato ni al nivel
de un ejemplar adulto — este módulo modela ese efecto marginal en el TIEMPO,
multiplicando (nunca reemplazando) los datos reales ya existentes
(`arboles_cupo_estimado`, `pm25_eficiencia` cualitativa) por un factor
0-1 que crece con los años desde la siembra.

## Qué SÍ está respaldado por evidencia real (y qué no)

1. **La categoría de velocidad de crecimiento (Lenta/Media/Rápida) por
   especie está validada con 2 fuentes reales independientes**:
   `backend/data/fichas_especies.json` (campo `tasa_crecimiento`, fuente:
   Morales y Varón 2013, SAO 2009, AMVA y UNAL 2014) y Vásquez-Bedoya &
   Arroyave-Maya (2019, Revista EIA vol.16 n.32) — mismo resultado en las 5
   especies.
2. **Los AÑOS concretos de maduración NO están validados igual de fuerte.**
   Para *Retrophyllum rospigliosii* (Pino Romerón) sí hay un ancla numérica
   real: ~12 mm/año de incremento en DAP medido en plantaciones andinas
   colombianas (Redalyc/Madera y Bosques) — de ahí el rango más alto (20-40
   años). Para las otras 4 especies, los años son una traducción de
   convención general de arboricultura urbana (rápido/medio/lento ajustado
   por porte final de la especie), NO medida en Medellín ni en estas
   especies puntuales.
3. **El SAU no tiene un campo real de madurez ni de DAP
   por individuo** en la capa pública actual (`sau_arboles_urbanos.csv`,
   confirmado contra los 26 campos que expone el servicio ArcGIS origen,
   ver `backend/scripts/fetch_sau_arboles.py`) — no fue posible anclar esto
   empíricamente con datos propios del proyecto.
4. **Este módulo modela el efecto MARGINAL del plan de siembra recomendado,
   no el PM2.5 total futuro de la ciudad** (tráfico, industria, políticas
   quedan fuera por completo).
5. El chequeo de orden de magnitud contra la Tabla 12-14 del Plan Distrital
   de Silvicultura Urbana (que sí usó i-Tree Eco real calibrado con datos
   del SAU) es una validación de PLAUSIBILIDAD, no una calibración numérica.
6. Si en el futuro se consigue data real de madurez/DAP del SAU, debe
   REEMPLAZAR esta estimación, no complementarla.

## La fórmula

Curva logística simple, calibrada para que en el año 0 el factor sea
cercano a 0 (2%) y en el año de maduración del escenario sea 90% —
nunca 100% exacto, un árbol no "termina" de madurar del todo:

    factor(t) = 1 / (1 + e^(-k · (t - t_mitad)))

`k` y `t_mitad` se resuelven en forma cerrada a partir de dos puntos fijos
(`factor(0) = 0.02`, `factor(anio_maduracion) = 0.9`) — ver
`_parametros_logistica()`. No es un ajuste estadístico a datos, es una
elección de forma de curva transparente y documentada.
"""

from __future__ import annotations

import math
from typing import Literal

from app.models.siembra import (
    FactorMaduracionEspecie,
    ProyeccionComuna,
    ProyeccionMaduracion,
    RecomendacionSiembraZona,
)

Escenario = Literal["optimista", "esperado", "conservador"]
ESCENARIOS: tuple[Escenario, ...] = ("optimista", "esperado", "conservador")
CategoriaCrecimiento = Literal["Rápida", "Media", "Lenta"]

FACTOR_INICIAL = 0.02  # factor en el año 0 (~2%, "cercano a 0" pero no exactamente 0)
FACTOR_MADUREZ = 0.90  # factor en el año de maduración del escenario (nunca 100%)

# Años hasta madurez funcional por especie y escenario. Fuente de cada
# columna documentada en el docstring del módulo (punto 2) y en
# `FUENTE_ANIOS_POR_ESPECIE` abajo — NO tratar estos números con la misma
# confianza que la categoría de crecimiento en sí.
ANIOS_MADURACION: dict[str, dict[Escenario, int]] = {
    "Zygia longifolia": {"optimista": 8, "esperado": 11, "conservador": 15},
    "Calliandra haematocephala": {"optimista": 4, "esperado": 6, "conservador": 8},
    "Inga densiflora": {"optimista": 8, "esperado": 11, "conservador": 15},
    "Bauhinia picta": {"optimista": 12, "esperado": 16, "conservador": 20},
    "Retrophyllum rospigliosii": {"optimista": 20, "esperado": 28, "conservador": 40},
}

CATEGORIA_CRECIMIENTO: dict[str, CategoriaCrecimiento] = {
    "Zygia longifolia": "Rápida",
    "Calliandra haematocephala": "Rápida",
    "Inga densiflora": "Rápida",
    "Bauhinia picta": "Media",
    "Retrophyllum rospigliosii": "Lenta",
}

FUENTE_CATEGORIA = (
    "Categoría de velocidad de crecimiento validada con 2 fuentes reales "
    "independientes: fichas_especies.json (tasa_crecimiento, fuente: Morales "
    "y Varón 2013 / SAO 2009 / AMVA y UNAL 2014) y Vásquez-Bedoya & "
    "Arroyave-Maya (2019, Revista EIA) — mismo resultado en las 5 especies."
)

FUENTE_ANIOS_POR_ESPECIE: dict[str, str] = {
    "Retrophyllum rospigliosii": (
        "Parcialmente anclado en dato real: ~12 mm/año de incremento en DAP "
        "medido en plantaciones andinas colombianas (Redalyc/Madera y "
        "Bosques). El año exacto de 'madurez funcional' urbana sigue siendo "
        "una estimación (DAP objetivo asumido, no medido en árboles urbanos)."
    ),
}
FUENTE_ANIOS_GENERICA = (
    "Convención general de arboricultura urbana (rápido/medio/lento, "
    "ajustada por porte final de la especie) — NO medida en Medellín ni en "
    "esta especie puntual."
)

CAVEATS_METODOLOGIA: list[str] = [
    "La categoría de velocidad de crecimiento (Lenta/Media/Rápida) está validada con 2 fuentes reales independientes; los años exactos de maduración no tienen ese mismo respaldo.",
    "El Sistema Árbol Urbano (SAU) no tiene un campo real de madurez ni de diámetro por individuo hoy — por eso se usó convención general de arboricultura en vez de un dato propio medido.",
    "Solo el Pino Romerón (Retrophyllum rospigliosii) tiene un ancla numérica real: crecimiento medido en plantaciones andinas colombianas. Las otras 4 especies usan convención general.",
    "Esto modela el efecto marginal del plan de siembra recomendado, no el PM2.5 total futuro de la ciudad (tráfico, industria y políticas quedan fuera del modelo).",
    "La comparación de orden de magnitud contra el Plan Distrital de Silvicultura Urbana (i-Tree Eco real) es una validación de plausibilidad, no una calibración numérica exacta.",
    "Si en el futuro se consigue data real de madurez o diámetro del SAU, debe reemplazar esta estimación, no complementarla.",
]


def _parametros_logistica(anio_maduracion: int) -> tuple[float, float]:
    """Resuelve (k, t_mitad) en forma cerrada para que la logística pase
    exactamente por (0, FACTOR_INICIAL) y (anio_maduracion, FACTOR_MADUREZ)."""
    logit_inicial = math.log(FACTOR_INICIAL / (1 - FACTOR_INICIAL))
    logit_madurez = math.log(FACTOR_MADUREZ / (1 - FACTOR_MADUREZ))
    k = (logit_madurez - logit_inicial) / anio_maduracion
    t_mitad = -logit_inicial / k
    return k, t_mitad


def factor_maduracion(anio: float, especie: str, escenario: Escenario) -> float:
    """Factor 0-1 de capacidad de mitigación alcanzada en `anio` años desde
    la siembra, para `especie` bajo `escenario`. Especies fuera del
    catálogo de las 5 documentadas devuelven 1.0 (sin penalización — no
    hay base real para estimar su curva, ver caveats)."""
    anios_por_escenario = ANIOS_MADURACION.get(especie)
    if anios_por_escenario is None:
        return 1.0
    anio_maduracion = anios_por_escenario[escenario]
    k, t_mitad = _parametros_logistica(anio_maduracion)
    t = max(0.0, anio)
    return 1 / (1 + math.exp(-k * (t - t_mitad)))


def fuente_anios(especie: str) -> str:
    return FUENTE_ANIOS_POR_ESPECIE.get(especie, FUENTE_ANIOS_GENERICA)


FORMULA_TEXTO = (
    "factor(t) = 1 / (1 + e^(-k * (t - t_mitad))), calibrada por especie/"
    "escenario para que factor(0) = 0.02 y factor(anio_maduracion) = 0.90. "
    "El factor multiplica (nunca reemplaza) arboles_cupo_estimado y la "
    "eficiencia cualitativa de mitigación ya existentes de cada zona."
)


def _factor_zona(
    zona: RecomendacionSiembraZona,
    diversificacion: dict | None,
    anio: float,
    escenario: Escenario,
) -> float:
    """Factor de maduración de UNA zona: ponderado por especie si la zona
    tiene propuesta de diversificación real (Fase E3, ~146 zonas con >=2
    especies compatibles); si no, el factor de la única especie recomendada
    de la zona (`especie_recomendada`)."""
    if diversificacion and diversificacion.get("diversificacion_disponible"):
        propuesta = diversificacion["propuesta_diversificacion"]
        return sum(
            item["proporcion"] * factor_maduracion(anio, item["especie"], escenario)
            for item in propuesta
        )
    return factor_maduracion(anio, zona.especie_recomendada, escenario)


def calcular_proyeccion(
    anio: float,
    escenario: Escenario,
    zonas: list[RecomendacionSiembraZona],
    diversificacion_por_id: dict[int, dict],
) -> ProyeccionMaduracion:
    """Agrega el factor de maduración por comuna y a nivel ciudad,
    ponderando siempre por `arboles_cupo_estimado` real de cada zona (nunca
    un promedio simple entre zonas de tamaños muy distintos)."""
    suma_ponderada_ciudad = 0.0
    cupo_total_ciudad = 0
    n_zonas_diversificadas = 0

    acumulado_comuna: dict[str, tuple[float, int]] = {}  # comuna -> (suma_ponderada, cupo_total)

    for zona in zonas:
        diversificacion = diversificacion_por_id.get(zona.id_poligono)
        if diversificacion and diversificacion.get("diversificacion_disponible"):
            n_zonas_diversificadas += 1
        factor_zona = _factor_zona(zona, diversificacion, anio, escenario)
        cupo = zona.arboles_cupo_estimado

        suma_ponderada_ciudad += factor_zona * cupo
        cupo_total_ciudad += cupo

        suma_comuna, cupo_comuna = acumulado_comuna.get(zona.comuna, (0.0, 0))
        acumulado_comuna[zona.comuna] = (suma_comuna + factor_zona * cupo, cupo_comuna + cupo)

    factor_promedio_ciudad = (suma_ponderada_ciudad / cupo_total_ciudad) if cupo_total_ciudad else 0.0

    por_comuna = [
        ProyeccionComuna(
            comuna=comuna,
            factor_promedio=round(suma / cupo, 4) if cupo else 0.0,
            arboles_cupo_estimado_total=cupo,
        )
        for comuna, (suma, cupo) in sorted(acumulado_comuna.items())
    ]

    por_especie = [
        FactorMaduracionEspecie(
            especie=especie,
            categoria_crecimiento=CATEGORIA_CRECIMIENTO[especie],
            anio_maduracion_escenario=ANIOS_MADURACION[especie][escenario],
            factor=round(factor_maduracion(anio, especie, escenario), 4),
            fuente_categoria=FUENTE_CATEGORIA,
            fuente_anios=fuente_anios(especie),
        )
        for especie in ANIOS_MADURACION
    ]

    anios_maduracion_por_escenario = {
        esc: {especie: ANIOS_MADURACION[especie][esc] for especie in ANIOS_MADURACION}
        for esc in ESCENARIOS
    }

    return ProyeccionMaduracion(
        anio=round(anio),
        escenario=escenario,
        factor_promedio_ciudad=round(factor_promedio_ciudad, 4),
        arboles_cupo_estimado_total=cupo_total_ciudad,
        n_zonas=len(zonas),
        n_zonas_con_diversificacion=n_zonas_diversificadas,
        por_especie=por_especie,
        por_comuna=por_comuna,
        anios_maduracion_por_escenario=anios_maduracion_por_escenario,
        caveats=CAVEATS_METODOLOGIA,
        formula=FORMULA_TEXTO,
    )
