from typing import Literal

from pydantic import BaseModel


class RecomendacionSiembraZona(BaseModel):
    """Fila de recomendacion_siembra_por_zona.csv (~1.649 zonas verdes)."""

    id_poligono: int
    comuna: str
    ranking_prioridad_comuna: int
    score_multicriteria: float
    tipologia: str
    categoria: str
    cobertura_actual: str
    area_m2: float
    area_ha: float
    especie_recomendada: str
    nombre_comun_especie: str
    arboles_cupo_estimado: int
    separacion_minima_m: float
    eficiencia_pm25: str
    especies_alternativas: str
    fuentes_botanicas: str


class ResumenRecomendacionComuna(BaseModel):
    """Fila de resumen_recomendacion_por_comuna.csv (score AHP agregado por comuna).

    `fuente_score` y `tiene_zona_siembra` distinguen las 11 comunas del
    pipeline original (`resumen_recomendacion_por_comuna.csv`, con zona de
    siembra concreta) de las 4 comunas recalculadas
    (`scores_ahp_extendido_sin_siembra.csv`) que tienen score AHP calculable
    (dato PM2.5 disponible) pero 0 zonas de siembra viables en el inventario
    real de zonas verdes — ver backend/README.md.
    """

    comuna: str
    ranking_prioridad: int
    score_multicriteria: float
    n_zonas_disponibles: int
    area_total_disponible_ha: float
    arboles_a_plantar_total: int
    especie_principal: str
    cupo_especie_principal: int
    pm25_promedio: float | None = None
    deficit_pct: float | None = None
    ratio_mitigadores: float | None = None
    fuente_score: str = "pipeline_original"
    tiene_zona_siembra: bool = True
    pm25_tipo_dato: Literal["medido", "interpolado", "sin_dato", "historico"] = "medido"
    pm25_confianza: Literal["media", "baja"] | None = None
    pm25_distancia_estacion_mas_cercana_km: float | None = None
    pm25_fecha_ultimo_dato: str | None = None


class RankingComunaItem(BaseModel):
    """Fila del ranking AHP recalculado con pesos custom (ver /api/siembra/ranking-comunas)."""

    comuna: str
    ranking_prioridad: int
    ranking_prioridad_original: int
    score_total: float
    n_pm25: float
    n_deficit: float
    n_area: float
    pm25_promedio: float | None = None
    deficit_pct: float | None = None
    area_total_disponible_ha: float
    especie_principal: str
    arboles_a_plantar_total: int
