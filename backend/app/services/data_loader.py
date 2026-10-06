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
from app.models.arbol_sau import ArbolSau, BalanceSau
from app.models.salud_respiratoria import ResumenSaludRespiratoriaResponse
from app.models.pm25 import EstacionPM25, IntegracionPM25Arboles, RelacionComunaAnual
from app.models.comuna import EstacionAuditoria
from app.models.poblacion import PoblacionComuna
from app.models.siembra import (
    FichaEspecie,
    RecomendacionSiembraZona,
    ResumenRecomendacionComuna,
)
from app.services.comuna_join import normalize_comuna_name

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
def load_fichas_especies() -> dict[str, FichaEspecie]:
    """`fichas_especies.json` (Fase E2): fichas botánicas reales por especie,
    indexadas por nombre científico exacto (mismo string que
    `especie_recomendada` en `recomendacion_siembra_por_zona.csv`). Ver
    backend/README.md. Opcional: si el archivo no existe, el endpoint de
    detalle de zona sigue funcionando sin `ficha_especie` (None)."""
    settings = get_settings()
    path = settings.data_fichas_especies
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)
    return {
        nombre: FichaEspecie.model_validate(datos)
        for nombre, datos in raw.get("especies", {}).items()
    }


@lru_cache
def load_diversificacion_especies_por_id() -> dict[int, dict]:
    """`diversificacion_especies_siembra.geojson` (Fase E3): propuesta
    EXPLORATORIA de reparto de individuos entre varias especies compatibles
    por zona, indexada por `id_poligono` — tabla sin geometría, igual patrón
    que `_auditoria_viabilidad_siembra_por_id`. Opcional: si el archivo no
    existe, el endpoint de detalle sigue funcionando con
    `diversificacion_disponible=False`. Ver
    backend/scripts/analizar_diversificacion_especies.py."""
    settings = get_settings()
    path = settings.data_diversificacion_especies_siembra
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)
    return {
        int(feature["properties"]["id_poligono"]): feature["properties"]
        for feature in raw["features"]
    }


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
def load_scores_ahp_extendido_sin_siembra() -> list[ResumenRecomendacionComuna]:
    """`scores_ahp_extendido_sin_siembra.csv`: comunas con score AHP calculable
    (dato PM2.5 disponible) pero 0 zonas de siembra viables en el inventario
    real de zonas verdes (GeoMedellín) — ver backend/README.md y
    `backend/scripts/recalcular_siembra_zonas_verdes_reales.py`. Si el archivo
    no existe, devuelve lista vacía (nunca 503): a diferencia del resumen
    original, esta es una fuente complementaria opcional, no crítica.
    """
    settings = get_settings()
    path = settings.data_scores_ahp_extendido_sin_siembra
    if not path.exists():
        return []
    df = pd.read_csv(path, encoding="utf-8-sig")
    df = df.astype(object).where(pd.notna(df), None)
    df["especie_principal"] = df["especie_principal"].fillna("")
    df["fuente_score"] = "recalculo_zonas_verdes_reales"
    df["tiene_zona_siembra"] = False
    df["pm25_tipo_dato"] = "medido"
    return [ResumenRecomendacionComuna.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_scores_ahp_interpolado_idw() -> list[ResumenRecomendacionComuna]:
    """`scores_ahp_interpolado_idw.csv`: Popular, Manrique y Doce de Octubre.

    Ninguna estación SIATA real cae dentro de estas 3 comunas (verificado con
    point-in-polygon). Su PM2.5 es un ESTIMADO por interpolación espacial IDW
    (`backend/scripts/calcular_pm25_interpolado_idw.py`), no una medición
    directa — y el score AHP hereda esa incertidumbre. `fuente_score` se
    marca explícitamente como "interpolado_idw" (distinto de
    "pipeline_original" y "recalculo_zonas_verdes_reales") y
    `pm25_tipo_dato`/`pm25_confianza`/`pm25_distancia_estacion_mas_cercana_km`
    se enriquecen desde `comunas_pm25_interpolado_meta.csv`. Si el archivo no
    existe, devuelve lista vacía (fuente complementaria opcional, igual que
    `load_scores_ahp_extendido_sin_siembra`). Ver backend/README.md.
    """
    settings = get_settings()
    path = settings.data_scores_ahp_interpolado_idw
    if not path.exists():
        return []
    df = pd.read_csv(path, encoding="utf-8-sig")
    df = df.astype(object).where(pd.notna(df), None)
    df["especie_principal"] = df["especie_principal"].fillna("")
    df["fuente_score"] = "interpolado_idw"
    df["tiene_zona_siembra"] = df["n_zonas_disponibles"] > 0
    df["pm25_tipo_dato"] = "interpolado"

    meta_path = settings.data_comunas_pm25_interpolado_meta
    meta_por_comuna: dict[str, dict] = {}
    if meta_path.exists():
        df_meta = pd.read_csv(meta_path, encoding="utf-8-sig")
        meta_por_comuna = {
            row["comuna"]: row for _, row in df_meta.iterrows()
        }

    df["pm25_confianza"] = df["comuna"].map(
        lambda c: meta_por_comuna[c]["confianza"] if c in meta_por_comuna else "media"
    )
    df["pm25_distancia_estacion_mas_cercana_km"] = df["comuna"].map(
        lambda c: (
            float(meta_por_comuna[c]["distancia_estacion_mas_cercana_km"])
            if c in meta_por_comuna
            else None
        )
    )
    return [ResumenRecomendacionComuna.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_scores_ahp_altavista_historico() -> list[ResumenRecomendacionComuna]:
    """`scores_ahp_altavista_historico.csv`: Altavista (cuarto nivel de confianza).

    PM2.5 REAL pero NO VIGENTE: promedio del ultimo año completo de datos
    (2024-09-25 a 2025-09-25, n=249 lecturas) de la estacion MED-ALTA2 ("IE
    Débora Arango, Altavista"), operada por Corantioquia y reportada en
    SISAIRE/IDEAM — fuente independiente de SIATA. La estación quedó inactiva
    el 2025-09-25 (~11 meses antes de esta integración). `fuente_score` se
    marca "historico_no_vigente" y `pm25_tipo_dato="historico"` (distinto de
    "medido"/"interpolado"/"sin_dato") para que nunca se confunda con un dato
    medido vigente o interpolado. Ver backend/README.md. Si el archivo no
    existe, devuelve lista vacía (fuente complementaria opcional).
    """
    settings = get_settings()
    path = settings.data_scores_ahp_altavista_historico
    if not path.exists():
        return []
    df = pd.read_csv(path, encoding="utf-8-sig")
    df = df.astype(object).where(pd.notna(df), None)
    df["especie_principal"] = df["especie_principal"].fillna("")
    df["fuente_score"] = "historico_no_vigente"
    df["tiene_zona_siembra"] = df["n_zonas_disponibles"] > 0
    df["pm25_tipo_dato"] = "historico"
    df["pm25_confianza"] = None
    df["pm25_distancia_estacion_mas_cercana_km"] = None
    return [ResumenRecomendacionComuna.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def _auditoria_viabilidad_siembra_por_id() -> dict[int, dict]:
    """`auditoria_viabilidad_siembra.geojson` (Fase D,
    `backend/scripts/auditar_viabilidad_siembra.py`): tabla de auditoría
    SIN geometría propia, indexada por `id_poligono` — nunca reemplaza ni
    modifica `zonas_priorizadas_siembra.geojson`, solo se cruza por id al
    servir el endpoint (ver `load_zonas_priorizadas_siembra_geojson`).
    Opcional: si el archivo no existe (auditoría no corrida todavía), el
    endpoint sigue funcionando sin el campo `viabilidad_auditada` — no es
    una fuente crítica, es un enriquecimiento de calidad de datos."""
    settings = get_settings()
    path = settings.data_auditoria_viabilidad_siembra
    if not path.exists():
        return {}
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)
    return {
        int(feature["properties"]["id_poligono"]): feature["properties"]
        for feature in raw["features"]
    }


@lru_cache
def load_zonas_priorizadas_siembra_geojson() -> dict:
    geojson = _read_geojson_wgs84(
        get_settings().data_zonas_priorizadas_siembra,
        "DATA_ZONAS_PRIORIZADAS_SIEMBRA",
    )
    auditoria = _auditoria_viabilidad_siembra_por_id()
    if not auditoria:
        return geojson
    for feature in geojson["features"]:
        aud = auditoria.get(int(feature["properties"]["id_poligono"]))
        feature["properties"]["viabilidad_auditada"] = (
            aud["viabilidad_auditada"] if aud else "sin_solape_con_inventario_real"
        )
        feature["properties"]["viabilidad_motivo"] = aud["viabilidad_motivo"] if aud else None
    return geojson


@lru_cache
def _area_km2_por_comuna_normalizada() -> dict[str, float]:
    """Área en km² por comuna (llave = nombre normalizado), calculada en el
    CRS proyectado original del shapefile (EPSG:9377, unidades = metros)
    antes de reproyectar a WGS84 — el área en grados no es interpretable."""
    settings = get_settings()
    path = _require_file(settings.data_limite_catastral_comunas, "DATA_LIMITE_CATASTRAL_COMUNAS")
    gdf = gpd.read_file(path)
    return {
        normalize_comuna_name(nombre): area_m2 / 1_000_000
        for nombre, area_m2 in zip(gdf["nombre"], gdf.geometry.area)
    }


@lru_cache
def load_poblacion_por_comuna() -> list[PoblacionComuna]:
    """poblacion_por_comuna.csv (proyección DANE, año fijo elegido en
    scripts/procesar_poblacion_comunas.py) enriquecido con área/densidad
    calculadas desde limite_catastral_de_comun.geojson, cruzando por nombre
    normalizado (ver app.services.comuna_join)."""
    settings = get_settings()
    df = _read_csv(settings.data_poblacion_por_comuna, "DATA_POBLACION_POR_COMUNA")
    # códigos DANE de 2 dígitos ('01'..'16','50'..'90'); pandas los infiere
    # como int y pierde el cero a la izquierda si no se fuerza el zfill.
    df["codigo_comuna"] = df["codigo_comuna"].astype(str).str.zfill(2)

    areas = _area_km2_por_comuna_normalizada()
    resultado: list[PoblacionComuna] = []
    for row in df.to_dict(orient="records"):
        area_km2 = areas.get(normalize_comuna_name(row["nombre_comuna"]))
        densidad = row["poblacion"] / area_km2 if area_km2 else None
        resultado.append(
            PoblacionComuna(
                codigo_comuna=row["codigo_comuna"],
                nombre_comuna=row["nombre_comuna"],
                anio=int(row["anio"]),
                poblacion=int(row["poblacion"]),
                area_km2=area_km2,
                densidad_hab_km2=densidad,
            )
        )
    return resultado


@lru_cache
def load_limite_catastral_comunas_geojson() -> dict:
    settings = get_settings()
    raw = _read_geojson_wgs84(
        settings.data_limite_catastral_comunas,
        "DATA_LIMITE_CATASTRAL_COMUNAS",
    )
    poblacion_por_nombre = {
        normalize_comuna_name(p.nombre_comuna): p for p in load_poblacion_por_comuna()
    }
    for feature in raw["features"]:
        props = feature["properties"]
        dato = poblacion_por_nombre.get(normalize_comuna_name(props["nombre"]))
        props["poblacion"] = dato.poblacion if dato else None
        props["poblacion_anio"] = dato.anio if dato else None
        props["area_km2"] = dato.area_km2 if dato else None
        props["densidad_hab_km2"] = dato.densidad_hab_km2 if dato else None
    return raw


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


def procesar_zonas_verdes_geojson(path: Path) -> dict:
    """Reproyecta, simplifica y recorta el inventario CRUDO de zonas verdes
    (48.348 polígonos, fuente GeoMedellín, ver backend/README.md).

    Tres optimizaciones para que el payload sea manejable en el mapa:
    1. simplify(tolerance=0.5m) en el CRS proyectado original (EPSG:9377,
       unidades = metros) antes de reproyectar: ~44% menos vértices con
       <0.12% de distorsión de área total.
    2. set_precision a grid_size=1e-6° (~0.11m) tras reproyectar: trunca el
       ruido decimal de flotantes que no aporta precisión visual.
    3. Se descartan las columnas *_subcategoria/*_componente/*_elemento de
       subsistemas (ap_/so_/ree_/sh_) que en la práctica son casi siempre
       "No aplica" y no se usan para colorear ni en el popup del mapa.

    Este cálculo tarda ~55s en frío — por eso NUNCA se corre en el camino de
    un request HTTP (causaba 502 en Render por timeout: ver backend/README.md,
    sección "Por qué /api/zonas-verdes sirve un archivo precomputado"). Se
    ejecuta una sola vez con `backend/scripts/preprocesar_zonas_verdes.py`,
    cuyo resultado consume `load_inventario_zonas_verdes_geojson` de abajo.
    """
    gdf = gpd.read_file(path)
    gdf["geometry"] = gdf.geometry.simplify(tolerance=0.5, preserve_topology=True)
    if gdf.crs is not None and str(gdf.crs) != WGS84:
        gdf = gdf.to_crs(WGS84)
    gdf["geometry"] = shapely.set_precision(gdf.geometry.values, grid_size=1e-6)

    gdf = gdf[_ZONAS_VERDES_PROPERTIES]
    return json.loads(gdf.to_json(drop_id=True))


@lru_cache
def load_inventario_zonas_verdes_geojson() -> dict:
    """Sirve el GeoJSON YA preprocesado por
    `backend/scripts/preprocesar_zonas_verdes.py` (ver
    `procesar_zonas_verdes_geojson` arriba para el detalle de las
    optimizaciones aplicadas). Solo lee y parsea JSON — nunca reproyecta ni
    simplifica geometría en el camino de un request HTTP."""
    settings = get_settings()
    path = settings.data_inventario_zonas_verdes_procesado
    _require_file(path, "DATA_INVENTARIO_ZONAS_VERDES_PROCESADO")
    with path.open(encoding="utf-8") as f:
        return json.load(f)


_SAU_COLUMNAS = {
    "objectid",
    "s_especie",
    "nombre_comun",
    "s_estado_arbol",
    "comuna",
    "barrio",
    "anio_ingreso",
    "lon",
    "lat",
}
_SAU_CATEGORICAS = {
    "s_especie": "category",
    "nombre_comun": "category",
    "s_estado_arbol": "category",
    "comuna": "category",
    "barrio": "category",
}


@lru_cache
def load_arboles_sau_df() -> pd.DataFrame:
    """DataFrame de sau_arboles_urbanos.csv (árboles vivos de Medellín), cacheado.

    Las columnas de texto se cargan como `category`: con ~430.000 filas el
    DataFrame ocupa ~15 MB en vez de ~300 MB (el backend corre en Render free,
    512 MB de RAM). Los NaN de las categóricas se convierten a None al momento
    de serializar (ver `puntos_en_bbox`), no aquí.
    """
    settings = get_settings()
    path = settings.data_sau_arboles_urbanos
    _require_file(path, "DATA_SAU_ARBOLES_URBANOS")
    return pd.read_csv(
        path,
        encoding="utf-8-sig",
        usecols=lambda c: c in _SAU_COLUMNAS,
        dtype=_SAU_CATEGORICAS,
    )


@lru_cache
def load_arboles_sau_balance() -> BalanceSau:
    """Balance por categoría (vivos, talados, desaparecidos...) y metadatos de corte."""
    settings = get_settings()
    path = settings.data_sau_arboles_balance
    _require_file(path, "DATA_SAU_ARBOLES_BALANCE")
    with path.open(encoding="utf-8") as f:
        return BalanceSau.model_validate(json.load(f))


def load_arboles_sau() -> list[ArbolSau]:
    df = load_arboles_sau_df()
    df = df.astype(object).where(pd.notna(df), None)
    return [ArbolSau.model_validate(row) for row in df.to_dict(orient="records")]


@lru_cache
def load_salud_respiratoria_resumen() -> ResumenSaludRespiratoriaResponse:
    """Resumen agregado (no crudo) de diagnósticos respiratorios por comuna.

    Pre-agregado por backend/scripts/fetch_salud_respiratoria.py con
    consultas SoQL del lado del servidor de Socrata: este loader solo lee un
    JSON pequeño, nunca re-consulta la API en cada arranque del backend. Ver
    backend/README.md, sección "Fuente de salud_respiratoria_resumen_comuna.json"
    para el caveat metodológico (red pública Metrosalud, no morbilidad total
    de la ciudad) — ese texto también viaja en el propio JSON (`metodologia`).
    """
    settings = get_settings()
    path = settings.data_salud_respiratoria_resumen_comuna
    _require_file(path, "DATA_SALUD_RESPIRATORIA_RESUMEN_COMUNA")
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)

    poblacion_por_nombre = {
        normalize_comuna_name(p.nombre_comuna): p.poblacion for p in load_poblacion_por_comuna()
    }
    for comuna in raw["comunas"]:
        poblacion = poblacion_por_nombre.get(normalize_comuna_name(comuna["comuna"]))
        comuna["tasa_por_1000_hab"] = (
            round(comuna["total_diagnosticos_respiratorios"] / poblacion * 1000, 2)
            if poblacion
            else None
        )
    raw["metodologia"] = (
        raw["metodologia"]
        + " La tasa por 1.000 habitantes usa como denominador la población total "
        "proyectada de la comuna (DANE), no la población atendida por Metrosalud "
        "específicamente: si la cobertura del régimen subsidiado varía mucho entre "
        "comunas, la tasa puede subestimar la carga real en comunas con menor "
        "proporción de población subsidiada, o sobreestimarla en comunas con mayor "
        "proporción. Se muestra junto al conteo absoluto, no en su reemplazo."
    )
    return ResumenSaludRespiratoriaResponse.model_validate(raw)


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
