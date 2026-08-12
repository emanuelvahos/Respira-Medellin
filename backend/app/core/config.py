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
    data_zonas_priorizadas_siembra: Path
    data_limite_catastral_comunas: Path
    data_inventario_zonas_verdes: Path
    data_solicitud_pm25_estaciones: Path
    data_sau_arboles_urbanos: Path

    cors_allowed_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
