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
import shapely
from fastapi import HTTPException

from app.core.config import get_settings
from app.models.arbol_sau import ArbolSau
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


def _read_geojson_wgs84(path: Path, env_var: str, simplify_tolerance: float | None = None) -> dict:
    _require_file(path, env_var)
    gdf = gpd.read_file(path)
    if simplify_tolerance is not None:
        # Simplificar en el CRS proyectado original (unidades = metros) antes
        # de reproyectar: la tolerancia es directamente interpretable y el
        # resultado es determinista frente al CRS destino.
        gdf["geometry"] = gdf.geometry.simplify(tolerance=simplify_tolerance, preserve_topology=True)
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


_ZONAS_VERDES_PROPERTIES = [
    "id_poligono",
    "tipologia",
    "categoria",
    "subcategoria",
    "cober_dom",
    "narb_aprox",
    "cubierta_verde",
    "potencial_verde",
    "observaciones",
    "geometry",
]


@lru_cache
def load_inventario_zonas_verdes_geojson() -> dict:
    """48.348 polígonos (fuente GeoMedellín, ver backend/README.md).

    Tres optimizaciones para que el payload sea manejable en el mapa:
    1. simplify(tolerance=0.5m) en el CRS proyectado original (EPSG:9377,
       unidades = metros) antes de reproyectar: ~44% menos vértices con
       <0.12% de distorsión de área total.
    2. set_precision a grid_size=1e-6° (~0.11m) tras reproyectar: trunca el
       ruido decimal de flotantes que no aporta precisión visual.
    3. Se descartan las columnas *_subcategoria/*_componente/*_elemento de
       subsistemas (ap_/so_/ree_/sh_) que en la práctica son casi siempre
       "No aplica" y no se usan para colorear ni en el popup del mapa.
    """
    settings = get_settings()
    path = settings.data_inventario_zonas_verdes
    _require_file(path, "DATA_INVENTARIO_ZONAS_VERDES")

    gdf = gpd.read_file(path)
    gdf["geometry"] = gdf.geometry.simplify(tolerance=0.5, preserve_topology=True)
    if gdf.crs is not None and str(gdf.crs) != WGS84:
        gdf = gdf.to_crs(WGS84)
    gdf["geometry"] = shapely.set_precision(gdf.geometry.values, grid_size=1e-6)

    gdf = gdf[_ZONAS_VERDES_PROPERTIES]
    return json.loads(gdf.to_json(drop_id=True))


@lru_cache
def load_arboles_sau_df() -> pd.DataFrame:
    """DataFrame crudo de sau_arboles_urbanos.csv, cacheado en memoria.

    Se expone como DataFrame (no `list[ArbolSau]`) porque las agregaciones de
    `app/services/arboles.py` (resumen por comuna, grid de clustering, bbox)
    son mucho más rápidas con pandas/numpy vectorizado que iterando 339.724
    objetos Pydantic en Python puro.
    """
    settings = get_settings()
    df = _read_csv(settings.data_sau_arboles_urbanos, "DATA_SAU_ARBOLES_URBANOS")
    df = df.astype(object).where(pd.notna(df), None)
    return df


def load_arboles_sau() -> list[ArbolSau]:
    df = load_arboles_sau_df()
    return [ArbolSau.model_validate(row) for row in df.to_dict(orient="records")]


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
