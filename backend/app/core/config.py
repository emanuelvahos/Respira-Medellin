from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    data_integracion_pm25_arboles: Path
    data_auditoria_estaciones_comunas: Path
    data_relaciones_bloque2: Path
    data_recomendacion_siembra_zona: Path
    data_resumen_recomendacion_comuna: Path
    data_scores_ahp_extendido_sin_siembra: Path = Path("./data/scores_ahp_extendido_sin_siembra.csv")
    data_scores_ahp_interpolado_idw: Path = Path("./data/scores_ahp_interpolado_idw.csv")
    data_comunas_pm25_interpolado_meta: Path = Path("./data/comunas_pm25_interpolado_meta.csv")
    data_scores_ahp_altavista_historico: Path = Path("./data/scores_ahp_altavista_historico.csv")
    data_zonas_priorizadas_siembra: Path
    data_auditoria_viabilidad_siembra: Path = Path("./data/auditoria_viabilidad_siembra.geojson")
    data_fichas_especies: Path = Path("./data/fichas_especies.json")
    data_diversificacion_especies_siembra: Path = Path(
        "./data/diversificacion_especies_siembra.geojson"
    )
    data_limite_catastral_comunas: Path
    data_inventario_zonas_verdes: Path
    data_inventario_zonas_verdes_procesado: Path = Path("./data/zonas_verdes_procesado.geojson")
    data_solicitud_pm25_estaciones: Path
    data_sau_arboles_urbanos: Path
    data_sau_arboles_balance: Path = Path("./data/sau_arboles_balance.json")
    data_ahp_v2_sau_por_comuna: Path = Path("./data/ahp_v2_sau_por_comuna.csv")
    data_ahp_v2_sau_resumen: Path = Path("./data/ahp_v2_sau_resumen.json")
    data_ndvi_por_comuna: Path = Path("./data/ndvi_por_comuna.csv")
    data_ndvi_meta: Path = Path("./data/ndvi_meta.json")
    data_aptitud_terreno: Path = Path("./data/aptitud_terreno_por_zona.csv")
    data_puntos_indicativos: Path = Path("./data/puntos_indicativos_siembra.geojson")
    data_capas_terreno_manifest: Path = Path("./data/capas_terreno_manifest.json")
    # Nivel 2 (puntos indicativos de siembra): apagado por defecto; se enciende con PUNTOS_INDICATIVOS_PUBLICOS=true
    puntos_indicativos_publicos: bool = False
    data_salud_respiratoria_resumen_comuna: Path
    data_poblacion_por_comuna: Path
    data_medata_mortalidad_respiratoria_comuna: Path = Path(
        "./data/medata_mortalidad_respiratoria_comuna.csv"
    )

    cors_allowed_origins: str = "http://localhost:3000"
    sentry_dsn: str | None = None

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
