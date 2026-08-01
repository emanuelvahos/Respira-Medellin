"""Recalcula el ranking AHP de comunas con pesos custom.

Replica la fórmula del script fuente
(`Visualizacion-de-datos/scripts/bloque_2/bloque2_recomendador_siembra.py`,
función `normalizar()` + cálculo de `score_total`, líneas ~227-384):

    n_x = (x - min(x)) / (max(x) - min(x))   # Min-Max a [0, 1]
          (si max == min, la serie es constante -> n_x = 0.5 para todas las filas)

    score_total = w_pm25 * n_pm25 + w_deficit * n_deficit + w_area * n_area
    ranking = rank(score_total, ascending=False)  # score más alto = ranking #1

## Sobre la población usada para el Min-Max (punto que requirió inspección
## cuidadosa del pipeline, no asumido a ciegas)

`resumen_recomendacion_por_comuna.csv` (lo único que persiste el pipeline a
nivel comuna) solo lista comunas con al menos una zona verde priorizada para
siembra. PERO en el script fuente, `normalizar()` se aplica sobre `df_score`,
que es la agregación de TODAS las comunas con datos PM2.5 de bloque_1
(`integracion_v2_pm25_arboles_medellin.csv`) — una población distinta y más
amplia que la de comunas-con-zonas. Confirmamos esto empíricamente: recalcular
el Min-Max solo sobre las 7 comunas que tienen AMBOS datos (PM2.5 y zonas) da
un orden distinto al de `ranking_prioridad` en el CSV (posiciones 3 y 4
intercambiadas: Castilla/La Candelaria); recalcularlo sobre la población
completa de bloque_1 (11 comunas con PM2.5, incluye Santa Cruz, Villa
Hermosa, San Cristóbal y Santa Elena, que NO tienen zonas priorizadas y por
tanto no aparecen en el resumen final) reproduce el orden exacto del CSV.

Esto es consistente con el propio código del script: `df_pm` (agregado de
bloque_1) es la base sobre la que se normaliza; `area_por_comuna` se le
une con LEFT JOIN (comunas de bloque_1 sin zona quedan con área=0); y el
resumen final por comuna se arma después, agregando desde las zonas
individuales (`df_zonas_rec.groupby("comuna")`) — por lo que incluye comunas
con zona pero SIN dato PM2.5 (Aranjuez, Buenos Aires, Laureles Estadio, San
Javier), a las que el script les asigna score=0 / ranking=99 como centinela
de "sin datos" (visible en el propio CSV fuente).

Este módulo reconstruye la MISMA población de bloque_1 a partir de datos que
el backend ya carga (`load_integracion_pm25_arboles`, agregado por comuna
igual que el script: `pm25_promedio=mean`, `ratio_mitigadores=first`,
`deficit_pct=clip(30-ratio, 0)`), y el área apta por comuna a partir de
`load_recomendacion_siembra_zona` (suma de `area_ha` por comuna — Min-Max es
invariante a escala, así que usar hectáreas en vez de m² del script da
resultados idénticos). No se re-ejecuta el spatial join ni se relee ningún
dato más allá de lo que el backend ya expone en otros endpoints.

El resultado final combina ambas poblaciones tal como lo hace el pipeline:
comunas con zona pero sin PM2.5 quedan con score=0 (sentinela "sin datos");
comunas con PM2.5 pero sin zona (Santa Cruz, Villa Hermosa, San Cristóbal,
Santa Elena) no aparecen en el ranking, igual que en el CSV fuente.

Con los pesos por defecto (0.45/0.35/0.20) el orden resultante reproduce
`ranking_prioridad` del CSV para las 7 comunas con datos completos.
"""

from app.models.pm25 import IntegracionPM25Arboles
from app.models.siembra import RankingComunaItem, RecomendacionSiembraZona, ResumenRecomendacionComuna

PESO_PM25_DEFECTO = 0.45
PESO_DEFICIT_DEFECTO = 0.35
PESO_AREA_DEFECTO = 0.20

TOLERANCIA_SUMA_PESOS = 1e-6

BENCHMARK_DEFICIT_PCT = 30.0  # igual que BENCHMARK_PCT en el script fuente


class PesosInvalidosError(ValueError):
    """Los 3 pesos no suman 1.0 (dentro de tolerancia de punto flotante)."""


def _normalizar(valores: list[float]) -> list[float]:
    """Min-Max -> [0, 1]. Serie constante -> 0.5 para todas las filas (igual que normalizar() del pipeline)."""
    if not valores:
        return []
    mn, mx = min(valores), max(valores)
    if mx == mn:
        return [0.5] * len(valores)
    return [(v - mn) / (mx - mn) for v in valores]


def validar_pesos(peso_pm25: float, peso_deficit: float, peso_area: float) -> None:
    suma = peso_pm25 + peso_deficit + peso_area
    if abs(suma - 1.0) > TOLERANCIA_SUMA_PESOS:
        raise PesosInvalidosError(
            f"Los pesos deben sumar 1.0 (± {TOLERANCIA_SUMA_PESOS}); "
            f"peso_pm25={peso_pm25} + peso_deficit={peso_deficit} + peso_area={peso_area} = {suma}."
        )


class _DatosComuna:
    __slots__ = ("comuna", "pm25_promedio", "ratio_mitigadores", "deficit_pct", "area_apta_ha")

    def __init__(self, comuna: str) -> None:
        self.comuna = comuna
        self.pm25_promedio: float | None = None
        self.ratio_mitigadores: float | None = None
        self.deficit_pct: float | None = None
        self.area_apta_ha: float = 0.0


def _construir_df_pm(integracion: list[IntegracionPM25Arboles]) -> dict[str, _DatosComuna]:
    """Replica `df_pm = df_b1.groupby("comuna").agg(pm25_promedio=mean, ratio_mitigadores=first)`."""
    suma_pm25: dict[str, float] = {}
    conteo_pm25: dict[str, int] = {}
    primer_ratio: dict[str, float] = {}

    for fila in integracion:
        suma_pm25[fila.comuna] = suma_pm25.get(fila.comuna, 0.0) + fila.pm25_promedio_ug_m3
        conteo_pm25[fila.comuna] = conteo_pm25.get(fila.comuna, 0) + 1
        if fila.comuna not in primer_ratio:
            primer_ratio[fila.comuna] = fila.ratio_mitigadores_pct

    resultado: dict[str, _DatosComuna] = {}
    for comuna, total in suma_pm25.items():
        d = _DatosComuna(comuna)
        d.pm25_promedio = round(total / conteo_pm25[comuna], 2)
        d.ratio_mitigadores = round(primer_ratio[comuna], 2)
        d.deficit_pct = round(max(0.0, BENCHMARK_DEFICIT_PCT - d.ratio_mitigadores), 2)
        resultado[comuna] = d
    return resultado


def _sumar_area_apta_por_comuna(zonas: list[RecomendacionSiembraZona]) -> dict[str, float]:
    """Replica `area_por_comuna = gdf_join.groupby("comuna_nombre")["Shape_Area"].sum()`.

    Usa `area_ha` (hectáreas) en vez de `Shape_Area` (m²) del script: Min-Max
    es invariante a un cambio de escala lineal, así que el resultado
    normalizado es idéntico.
    """
    totales: dict[str, float] = {}
    for zona in zonas:
        totales[zona.comuna] = totales.get(zona.comuna, 0.0) + zona.area_ha
    return totales


def calcular_ranking_comunas(
    resumen: list[ResumenRecomendacionComuna],
    integracion_pm25: list[IntegracionPM25Arboles],
    zonas_siembra: list[RecomendacionSiembraZona],
    peso_pm25: float = PESO_PM25_DEFECTO,
    peso_deficit: float = PESO_DEFICIT_DEFECTO,
    peso_area: float = PESO_AREA_DEFECTO,
) -> list[RankingComunaItem]:
    validar_pesos(peso_pm25, peso_deficit, peso_area)

    df_pm = _construir_df_pm(integracion_pm25)
    area_por_comuna = _sumar_area_apta_por_comuna(zonas_siembra)

    # df_score = df_pm con área unida (LEFT JOIN, 0 si la comuna no tiene zona).
    for comuna, datos in df_pm.items():
        datos.area_apta_ha = area_por_comuna.get(comuna, 0.0)

    n_pm25_por_comuna = dict(
        zip(df_pm.keys(), _normalizar([d.pm25_promedio for d in df_pm.values()]))  # type: ignore[misc]
    )
    n_deficit_por_comuna = dict(
        zip(df_pm.keys(), _normalizar([d.deficit_pct for d in df_pm.values()]))  # type: ignore[misc]
    )
    n_area_por_comuna = dict(
        zip(df_pm.keys(), _normalizar([d.area_apta_ha for d in df_pm.values()]))
    )

    items: list[RankingComunaItem] = []
    for r in resumen:
        tiene_pm25 = r.comuna in df_pm
        n_pm25 = n_pm25_por_comuna.get(r.comuna, 0.0)
        n_deficit = n_deficit_por_comuna.get(r.comuna, 0.0)
        n_area = n_area_por_comuna.get(r.comuna, 0.0)
        score = (
            (peso_pm25 * n_pm25 + peso_deficit * n_deficit + peso_area * n_area)
            if tiene_pm25
            else 0.0  # sentinela "sin datos", igual que score=0/rank=99 en el CSV fuente
        )
        items.append(
            RankingComunaItem(
                comuna=r.comuna,
                ranking_prioridad=0,  # se asigna abajo tras ordenar
                ranking_prioridad_original=r.ranking_prioridad,
                score_total=round(score, 4),
                n_pm25=round(n_pm25, 4) if tiene_pm25 else 0.0,
                n_deficit=round(n_deficit, 4) if tiene_pm25 else 0.0,
                n_area=round(n_area, 4) if tiene_pm25 else 0.0,
                pm25_promedio=r.pm25_promedio,
                deficit_pct=r.deficit_pct,
                area_total_disponible_ha=r.area_total_disponible_ha,
                especie_principal=r.especie_principal,
                arboles_a_plantar_total=r.arboles_a_plantar_total,
            )
        )

    items.sort(key=lambda it: it.score_total, reverse=True)
    for i, it in enumerate(items, start=1):
        it.ranking_prioridad = i

    return items
