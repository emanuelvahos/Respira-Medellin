"""Pruebas del cálculo de aptitud (sin red): capas sintéticas en metros (EPSG:9377)."""
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import LineString, Point, box

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import calcular_aptitud_terreno as ca  # noqa: E402

CRS = 9377


def _vacia(cols=()):
    return gpd.GeoDataFrame({c: [] for c in cols}, geometry=[], crs=CRS)


def _capas(**kw):
    base = {
        "mov_masa": _vacia(["grado_amenaza"]), "inundacion": _vacia(["grado_amenaza"]),
        "torrencial": _vacia(["grado_amenaza"]), "riesgo_mm": _vacia(["riesgo"]),
        "retiros": _vacia(), "tension": _vacia(), "anden": _vacia(["ancho"]),
        "poste": _vacia(), "redes": _vacia(["tipo_servicio"]),
    }
    base.update(kw)
    return base


def _correr(geoms, capas, pendiente=5.0, arboles=None):
    zonas = gpd.GeoDataFrame({"id_poligono": range(1, len(geoms) + 1)}, geometry=geoms, crs=CRS)
    recom = pd.DataFrame({
        "id_poligono": range(1, len(geoms) + 1), "separacion_minima_m": 8.5, "arboles_cupo_estimado": 50,
        "nombre_comun_especie": "Suribio", "especie_recomendada": "Zygia longifolia",
    })
    mosaico = np.full((400, 400), pendiente, dtype="float32")
    return ca.procesar(zonas, recom, capas, mosaico, (0.0, 4000.0), 10.0, arboles)


def test_zona_libre_es_apta_y_genera_puntos():
    df, gp = _correr([box(100, 3000, 140, 3040)], _capas())
    assert df.loc[0, "aptitud"] == "apta"
    assert df.loc[0, "puntos_indicativos"] > 3
    assert len(gp) == df.loc[0, "puntos_indicativos"]


def test_pendiente_fuerte_no_apta_y_sin_puntos():
    df, gp = _correr([box(100, 3000, 140, 3040)], _capas(), pendiente=40.0)
    assert df.loc[0, "aptitud"] == "no_apta" and "Pendiente" in df.loc[0, "motivos_no_apta"]
    assert len(gp) == 0


def test_pendiente_media_es_condicion():
    df, _ = _correr([box(100, 3000, 140, 3040)], _capas(), pendiente=25.0)
    assert df.loc[0, "aptitud"] == "apta_con_condiciones"


def test_franja_de_tension_total_no_apta():
    tension = gpd.GeoDataFrame(geometry=[box(90, 2990, 150, 3050)], crs=CRS)
    df, _ = _correr([box(100, 3000, 140, 3040)], _capas(tension=tension))
    assert df.loc[0, "aptitud"] == "no_apta"


def test_poste_descarta_puntos_cercanos():
    z = box(100, 3000, 140, 3040)
    sin, _ = _correr([z], _capas())
    poste = gpd.GeoDataFrame(geometry=[Point(120, 3020)], crs=CRS)
    con, gp = _correr([z], _capas(poste=poste))
    assert con.loc[0, "puntos_indicativos"] <= sin.loc[0, "puntos_indicativos"]
    assert all(Point(p.x, p.y).distance(Point(120, 3020)) >= ca.DIST_POSTE_M - 1e-6 for p in gp.geometry)


def test_red_de_agua_marca_condicion_y_exclusion():
    red = gpd.GeoDataFrame({"tipo_servicio": ["Alcantarillado"]}, geometry=[LineString([(100, 3020), (140, 3020)])], crs=CRS)
    df, gp = _correr([box(100, 3000, 140, 3040)], _capas(redes=red))
    assert "alcantarillado" in df.loc[0, "condiciones"].lower()
    assert all(abs(p.y - 3020) >= ca.DIST_RED_AGUA_M - 1e-6 for p in gp.geometry)


def test_arbol_existente_se_respeta():
    z = box(100, 3000, 140, 3040)
    arb = np.array([[120.0, 3020.0]])
    _, gp = _correr([z], _capas(), arboles=arb)
    assert all(np.hypot(p.x - 120, p.y - 3020) >= 8.5 / 2 - 1e-6 for p in gp.geometry)


def test_cupo_limita_puntos():
    df, _ = _correr([box(0, 3000, 400, 3400)], _capas())
    assert df.loc[0, "puntos_indicativos"] == 50


def test_amenaza_alta_es_condicion():
    mm = gpd.GeoDataFrame({"grado_amenaza": ["Alta"]}, geometry=[box(90, 2990, 150, 3050)], crs=CRS)
    df, _ = _correr([box(100, 3000, 140, 3040)], _capas(mov_masa=mm))
    assert df.loc[0, "aptitud"] == "apta_con_condiciones"
    assert df.loc[0, "frac_mm_alta"] == 1.0
