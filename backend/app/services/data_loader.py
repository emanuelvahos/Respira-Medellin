"""Carga en memoria (y cachea) los datasets ya generados por el pipeline.

Este módulo NO reprocesa lógica de negocio (AHP, spatial join, etc.): solo
lee CSV/GeoJSON desde disco, tipa las filas con los modelos Pydantic
correspondientes y reproyecta geometrías a WGS84 (EPSG:4326) cuando el
archivo fuente viene en otro CRS, para que sea consumible directamente por
librerías de mapas (Mapbox/deck.gl) en fases futuras.
"""

import json
from functools import lru_cache
from pathlib import Path

import geopandas as gpd
import pandas as pd
from fastapi import HTTPException

from app.core.config import get_settings
from app.models.pm25 import EstacionPM25, IntegracionPM25Arboles, RelacionComunaAnual
from app.models.comuna import EstacionAuditoria
from app.models.siembra import RecomendacionSiembraZona, ResumenRecomendacionComuna

WGS84 = "EPSG:4326"


def _require_file(path: Path, env_var: str) -> Path:
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail=(
                f"No se encontró el archivo de datos en '{path}'. "
                f"Revisa la variable de entorno {env_var} en backend/.env "
                "y confirma que apunta a tu copia local del repo de datos."
            ),
        )
    return path


def _read_csv(path: Path, env_var: str) -> pd.DataFrame:
    _require_file(path, env_var)
    return pd.read_csv(path, encoding="utf-8-sig")


def _read_geojson_wgs84(path: Path, env_var: str) -> dict:
    _require_file(path, env_var)
    gdf = gpd.read_file(path)
    if gdf.crs is not None and str(gdf.crs) != WGS84:
        gdf = gdf.to_crs(WGS84)
    return json.loads(gdf.to_json())


@lru_cache
def load_integracion_pm25_arboles() -> list[IntegracionPM25Arboles]:
    settings = get_settings()
    df = _read_csv(
        settings.data_integracion_pm25_arboles,
        "DATA_INTEGRACION_PM25_ARBOLES",
    ).rename(columns={"año": "anio"})
    return [IntegracionPM25Arboles.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_relaciones_bloque2() -> list[RelacionComunaAnual]:
    settings = get_settings()
    df = _read_csv(settings.data_relaciones_bloque2, "DATA_RELACIONES_BLOQUE2").rename(
        columns={"año": "anio"}
    )
    return [RelacionComunaAnual.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_auditoria_estaciones_comunas() -> list[EstacionAuditoria]:
    settings = get_settings()
    df = _read_csv(
        settings.data_auditoria_estaciones_comunas,
        "DATA_AUDITORIA_ESTACIONES_COMUNAS",
    ).rename(columns={"Municipio": "municipio"})
    return [EstacionAuditoria.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_recomendacion_siembra_zona() -> list[RecomendacionSiembraZona]:
    settings = get_settings()
    df = _read_csv(
        settings.data_recomendacion_siembra_zona,
        "DATA_RECOMENDACION_SIEMBRA_ZONA",
    )
    return [RecomendacionSiembraZona.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_resumen_recomendacion_comuna() -> list[ResumenRecomendacionComuna]:
    settings = get_settings()
    df = _read_csv(
        settings.data_resumen_recomendacion_comuna,
        "DATA_RESUMEN_RECOMENDACION_COMUNA",
    )
    # astype(object) evita que pandas reconvierta None a NaN en columnas
    # float64 al aplicar .where() (None no es representable en float64).
    df = df.astype(object).where(pd.notna(df), None)
    return [ResumenRecomendacionComuna.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_zonas_priorizadas_siembra_geojson() -> dict:
    settings = get_settings()
    return _read_geojson_wgs84(
        settings.data_zonas_priorizadas_siembra,
        "DATA_ZONAS_PRIORIZADAS_SIEMBRA",
    )


@lru_cache
def load_limite_catastral_comunas_geojson() -> dict:
    settings = get_settings()
    return _read_geojson_wgs84(
        settings.data_limite_catastral_comunas,
        "DATA_LIMITE_CATASTRAL_COMUNAS",
    )


@lru_cache
def load_inventario_zonas_verdes_geojson() -> dict:
    settings = get_settings()
    return _read_geojson_wgs84(
        settings.data_inventario_zonas_verdes,
        "DATA_INVENTARIO_ZONAS_VERDES",
    )


@lru_cache
def load_estaciones_pm25() -> list[EstacionPM25]:
    """Última lectura real por estación SIATA.

    `Solicitud_PM25_DP1763941.csv` es una serie horaria ancha (una columna por
    código de estación); para cada columna se toma la última fila no nula
    (`last_valid_index`), que puede corresponder a una fecha distinta por
    estación si alguna dejó de reportar antes que las demás. Las coordenadas y
    la comuna asignada salen del spatial join ya calculado en
    `auditoria_estaciones_comunas.csv` (misma fuente que `EstacionAuditoria`),
    cruzando por `codigo_estacion`.
    """
    settings = get_settings()
    df = _read_csv(
        settings.data_solicitud_pm25_estaciones,
        "DATA_SOLICITUD_PM25_ESTACIONES",
    )
    df["Fecha"] = pd.to_datetime(df["Fecha"])

    estaciones_por_codigo = {e.codigo_estacion: e for e in load_auditoria_estaciones_comunas()}

    resultado: list[EstacionPM25] = []
    for codigo in df.columns:
        if codigo == "Fecha":
            continue
        estacion = estaciones_por_codigo.get(codigo)
        if estacion is None:
            continue
        serie = df[codigo]
        idx = serie.last_valid_index()
        if idx is None:
            continue
        resultado.append(
            EstacionPM25(
                id=codigo,
                nombre=estacion.nombre_estacion,
                lat=estacion.latitud,
                lon=estacion.longitud,
                valor_ug_m3=float(serie.loc[idx]),
                fecha_lectura=df.loc[idx, "Fecha"].isoformat(),
                comuna_asignada=estacion.comuna_por_gis,
            )
        )
    return resultado
