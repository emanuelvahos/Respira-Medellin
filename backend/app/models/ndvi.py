from pydantic import BaseModel


class NdviComuna(BaseModel):
    comuna: str
    es_urbana: bool
    ndvi_mediana: float | None
    ndvi_media: float | None
    pct_vegetacion_densa: float | None
    pct_pixeles_validos: float
    arboles_vivos: int
    arboles_por_km2: float | None
    arboles_por_1000_hab: float | None
    ratio_mitigadores_pct: float | None


class NdviCorrelacion(BaseModel):
    variable: str
    n_comunas: int
    spearman: float | None
    lectura: str


class NdviResumen(BaseModel):
    fuente: str
    periodo: str
    fechas_utilizadas: int
    resolucion_m: int
    umbral_vegetacion_densa: float
    comunas: list[NdviComuna]
    correlaciones: list[NdviCorrelacion]
    advertencias: list[str]
