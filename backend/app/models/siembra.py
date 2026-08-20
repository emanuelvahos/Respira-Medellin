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


class FichaEspecie(BaseModel):
    """Ficha botánica real de una especie mitigadora, extraída del catálogo
    `ESPECIES` del pipeline original (`bloque2_recomendador_siembra.py`) y
    cruzada con el Catálogo de Flora del Valle de Aburrá (EIA) — ver
    `backend/data/fichas_especies.json` y backend/README.md. Ningún campo es
    inventado: si un dato no existe en ninguna de las dos fuentes, no se
    incluye la especie (o el campo queda ausente), nunca se rellena.
    """

    nombre_comun: str
    familia: str
    origen: str
    distribucion_geografica: str
    altura_max_m: float
    amplitud_copa: str
    copa_min_m: float
    margen_seguridad_m: float
    densidad_follaje: str
    tasa_crecimiento: str
    longevidad: str
    rango_altitudinal_msnm: list[int]
    tipo_suelo: list[str]
    requerimiento_luminosidad: str
    pm25_eficiencia: str
    funcion: list[str]
    usos_espacio_publico: list[str]
    estado_conservacion: str
    fuentes: str


class EspecieDiversificacion(BaseModel):
    """Una especie dentro de la propuesta de diversificación de una zona
    (Fase E3) — NUNCA la recomendación oficial del pipeline, ver
    `ZonaSiembraDetalle.diversificacion_disponible`."""

    especie: str
    individuos_estimado: int
    proporcion: float


class ZonaSiembraDetalle(BaseModel):
    """Respuesta de `/api/siembra/zona/{id_poligono}/detalle` (Fase E2):
    junta la fila real de `recomendacion_siembra_por_zona.csv` para esa zona
    con la ficha botánica real de su especie recomendada (si existe en
    `fichas_especies.json`). Ver backend/README.md, sección "Detalle de zona
    de siembra (Fase E2)" para la fórmula de individuos recomendados y por
    qué NO se calcula un número de PM2.5 mitigado (ningún dato real
    disponible lo cuantifica por individuo)."""

    id_poligono: int
    comuna: str
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
    ficha_especie: FichaEspecie | None = None
    # Fase E3 — propuesta EXPLORATORIA de diversificación (no la
    # recomendación oficial). `False`/`None` si la zona tiene menos de 2
    # especies compatibles reales o menos de 10 individuos de cupo — ver
    # backend/scripts/analizar_diversificacion_especies.py.
    diversificacion_disponible: bool = False
    propuesta_diversificacion: list[EspecieDiversificacion] | None = None
    # Motivo real de por qué no hay propuesta cuando diversificacion_disponible
    # es False (1 sola especie compatible vs. cupo por debajo del umbral) —
    # para que el frontend no adivine ni generalice el mensaje.
    n_especies_compatibles: int | None = None


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
