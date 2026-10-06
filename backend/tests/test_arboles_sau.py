"""Pruebas de las agregaciones del SAU con un DataFrame sintético (columnas categóricas,
igual que `load_arboles_sau_df`), sin depender del tamaño del dataset real."""

import pandas as pd

from app.services.arboles import clusters_grid, puntos_en_bbox, resumen_por_comuna

CATEGORICAS = ["s_especie", "nombre_comun", "s_estado_arbol", "comuna", "barrio"]


def _df() -> pd.DataFrame:
    df = pd.DataFrame(
        {
            "objectid": [1, 2, 3, 4, 5],
            "s_especie": ["Ficus benjamina", "Ficus benjamina", "Fraxinus uhdei", None, "Fraxinus uhdei"],
            "nombre_comun": ["Ficus", "Ficus", "Urapán", None, "Urapán"],
            "s_estado_arbol": ["Individuo Sano", "Individuo Enfermo", "Individuo Sano", None, "Individuo Sano"],
            "comuna": ["Belén", "Belén", "El Poblado", "El Poblado", None],
            "barrio": ["A", "A", "B", None, None],
            "anio_ingreso": [2015, 2016, 2020, None, 2022],
            "lon": [-75.60, -75.601, -75.57, -75.571, -75.50],
            "lat": [6.23, 6.231, 6.21, 6.211, 6.30],
        }
    )
    return df.astype({c: "category" for c in CATEGORICAS})


def test_resumen_por_comuna_cuenta_y_ordena():
    res = resumen_por_comuna(_df())
    assert [r.comuna for r in res] == ["Belén", "El Poblado"] or [r.comuna for r in res] == ["El Poblado", "Belén"]
    assert sum(r.total_arboles for r in res) == 4  # el árbol sin comuna se excluye
    belen = next(r for r in res if r.comuna == "Belén")
    assert belen.top_especies[0].especie == "Ficus benjamina"
    assert belen.top_especies[0].cantidad == 2
    assert {e.estado for e in belen.distribucion_estado} == {"Individuo Sano", "Individuo Enfermo"}


def test_resumen_no_incluye_categorias_sin_observaciones():
    # `observed=True`: una comuna que existe como categoría pero sin filas no debe aparecer
    df = _df()
    df = df[df["comuna"] != "Belén"].copy()
    df["comuna"] = df["comuna"].cat.set_categories(["Belén", "El Poblado"])
    res = resumen_por_comuna(df)
    assert [r.comuna for r in res] == ["El Poblado"]


def test_puntos_en_bbox_serializa_nulos_a_none():
    puntos, truncado = puntos_en_bbox(_df(), -75.58, 6.20, -75.56, 6.22, limit=10)
    assert not truncado
    assert len(puntos) == 2
    nulo = next(p for p in puntos if p.objectid == 4)
    assert nulo.s_especie is None and nulo.barrio is None


def test_puntos_en_bbox_trunca_con_limite():
    puntos, truncado = puntos_en_bbox(_df(), -76, 6, -75, 7, limit=2)
    assert truncado and len(puntos) == 2


def test_clusters_grid_suma_todos_los_arboles():
    clusters = clusters_grid(_df(), cell_size_deg=0.01)
    assert sum(c.cantidad for c in clusters) == 5
