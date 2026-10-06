from pydantic import BaseModel


class AhpV2Comuna(BaseModel):
    """Fila de ahp_v2_sau_por_comuna.csv (generado por scripts/calcular_ahp_v2_sau.py).

    Compara el AHP v1 (conteo de árboles del Excel antiguo del pipeline) con el
    v2 (déficit de especies mitigadoras calculado sobre el SAU actual). v1 no se
    modifica. `*_11`: población de las 11 comunas originales (comparación
    directa); `*_15`: las 15 comunas con algún PM2.5 (cada una con su confianza).
    """

    comuna: str
    grupo: str
    pm25_promedio: float | None = None
    pm25_tipo_dato: str
    pm25_confianza: str
    tiene_zona_siembra: bool
    area_total_disponible_ha: float
    n_zonas_disponibles: int
    arboles_a_plantar_total: int
    poblacion: int | None = None
    arboles_vivos_sau: int | None = None
    mitigadores_sau: int | None = None
    arboles_por_1000_hab: float | None = None
    ratio_mitigadores_v1_pct: float | None = None
    deficit_v1_pct: float | None = None
    ratio_mitigadores_v2_pct: float | None = None
    deficit_v2_pct: float | None = None
    score_v1: float | None = None
    rank_v1_original: int | None = None
    rank_v1_11: int | None = None
    score_v2_11: float | None = None
    rank_v2_11: int | None = None
    cambio_posicion_11: int | None = None
    n_pm25_15: float | None = None
    n_deficit_15: float | None = None
    n_area_15: float | None = None
    score_v2_15: float | None = None
    rank_v2_15: int | None = None


class AhpV2Pesos(BaseModel):
    pm25: float
    deficit: float
    area: float


class AhpV2Resumen(BaseModel):
    """Robustez v1 vs v2 (ahp_v2_sau_resumen.json)."""

    especies_mitigadoras: list[str]
    pesos: AhpV2Pesos
    benchmark_deficit_pct: float
    arboles_v1_total_11_comunas: int
    arboles_vivos_sau_total_11_comunas: int
    arboles_vivos_sau_total_medellin: int
    spearman_rank_v1_vs_v2_11: float
    top5_v1: list[str]
    top5_v2: list[str]
    top5_coinciden: int
    rango_deficit_v2_pct: list[float]
    advertencia: str
