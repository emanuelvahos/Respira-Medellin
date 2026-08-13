"""Tests para la reproyección de geometrías EPSG:9377 -> EPSG:4326 (WGS84).

`app/services/data_loader.py` no tiene una función de reproyección "custom":
usa `geopandas.GeoDataFrame.to_crs` genérico dentro de `_read_geojson_wgs84`
(usada por `load_limite_catastral_comunas_geojson`, entre otros). Este test
reproyecta directamente con geopandas un punto REAL tomado del archivo fuente
`data/limite_catastral_de_comun.geojson` (CRS nativo EPSG:9377, confirmado
leyendo el archivo) y verifica que cae dentro del rango geográfico de
Medellín, y además confirma que el loader cacheado del backend reproyecta al
mismo punto.
"""

import geopandas as gpd
import shapely.geometry as sg

from app.services.data_loader import WGS84, load_limite_catastral_comunas_geojson

LON_MIN, LON_MAX = -75.8, -75.4
LAT_MIN, LAT_MAX = 6.0, 6.5


def test_fuente_limite_catastral_esta_en_epsg_9377():
    gdf = gpd.read_file("data/limite_catastral_de_comun.geojson")
    assert str(gdf.crs) == "EPSG:9377"


def test_reproyeccion_punto_real_cae_en_rango_medellin():
    gdf = gpd.read_file("data/limite_catastral_de_comun.geojson")
    # Punto real (centroide del primer polígono, comuna BELEN), en EPSG:9377.
    centroide_9377 = gdf.geometry.iloc[0].centroid
    assert (centroide_9377.x, centroide_9377.y) == (
        4712490.988628342,
        2246621.8602580205,
    )

    gdf_wgs84 = gdf.to_crs(WGS84)
    centroide_wgs84 = gdf_wgs84.geometry.iloc[0].centroid

    assert LON_MIN <= centroide_wgs84.x <= LON_MAX
    assert LAT_MIN <= centroide_wgs84.y <= LAT_MAX


def test_loader_del_backend_reproyecta_el_mismo_punto():
    raw = load_limite_catastral_comunas_geojson()
    feature_belen = next(f for f in raw["features"] if f["properties"]["nombre"] == "BELEN")
    geom = sg.shape(feature_belen["geometry"])
    centroide = geom.centroid

    assert LON_MIN <= centroide.x <= LON_MAX
    assert LAT_MIN <= centroide.y <= LAT_MAX
    # Valores reales verificados ejecutando el loader (redondeados para evitar
    # fragilidad ante cambios mínimos de versión de pyproj/GEOS).
    assert round(centroide.x, 3) == round(-75.59915980197546, 3)
    assert round(centroide.y, 3) == round(6.225574449663387, 3)
