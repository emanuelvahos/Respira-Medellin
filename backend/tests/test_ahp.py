"""Tests para app/services/ahp.py (ranking AHP) contra los datos reales del repo.

Los valores "golden" usados aquí se verificaron ejecutando
`calcular_ranking_comunas` contra los CSV reales en `backend/data/` (no se
inventaron): con los pesos por defecto (0.45/0.35/0.20), el orden resultante
es Guayabal, Belen, Castilla, La Candelaria, El Poblado, Robledo, La America,
seguido de las 4 comunas "sin dato PM2.5" (score=0) en orden estable.
"""

from fastapi.testclient import TestClient

from app.main import app
from app.services.ahp import calcular_ranking_comunas
from app.services.data_loader import (
    load_integracion_pm25_arboles,
    load_recomendacion_siembra_zona,
    load_resumen_recomendacion_comuna,
)

client = TestClient(app)


def _cargar_poblacion():
    return (
        load_resumen_recomendacion_comuna(),
        load_integracion_pm25_arboles(),
        load_recomendacion_siembra_zona(),
    )


def test_ranking_pesos_por_defecto_orden_real():
    resumen, integracion, zonas = _cargar_poblacion()
    items = calcular_ranking_comunas(resumen, integracion, zonas)

    orden = [it.comuna for it in items]
    # Verificado ejecutando el cálculo real contra backend/data/*.csv.
    assert orden[:5] == [
        "Guayabal",
        "Belén",
        "Castilla",
        "La Candelaria",
        "El Poblado",
    ]
    # ranking_prioridad se asigna 1..N tras ordenar por score descendente.
    assert [it.ranking_prioridad for it in items[:5]] == [1, 2, 3, 4, 5]


def test_ranking_endpoint_pesos_por_defecto_coincide_con_calculo_directo():
    resumen, integracion, zonas = _cargar_poblacion()
    esperado = calcular_ranking_comunas(resumen, integracion, zonas)

    resp = client.get("/api/siembra/ranking-comunas")
    assert resp.status_code == 200
    data = resp.json()
    assert [d["comuna"] for d in data] == [it.comuna for it in esperado]


def test_pesos_que_no_suman_uno_devuelven_422_via_endpoint():
    resp = client.get(
        "/api/siembra/ranking-comunas",
        params={"peso_pm25": 0.5, "peso_deficit": 0.5, "peso_area": 0.5},
    )
    assert resp.status_code == 422


def test_pesos_que_no_suman_uno_lanzan_error_en_calculo_directo():
    resumen, integracion, zonas = _cargar_poblacion()
    from app.services.ahp import PesosInvalidosError
    import pytest

    with pytest.raises(PesosInvalidosError):
        calcular_ranking_comunas(
            resumen, integracion, zonas, peso_pm25=0.5, peso_deficit=0.5, peso_area=0.5
        )


def test_pesos_custom_validos_producen_orden_distinto_al_default():
    resumen, integracion, zonas = _cargar_poblacion()
    default = calcular_ranking_comunas(resumen, integracion, zonas)
    custom = calcular_ranking_comunas(
        resumen, integracion, zonas, peso_pm25=0.2, peso_deficit=0.2, peso_area=0.6
    )
    orden_default = [it.comuna for it in default]
    orden_custom = [it.comuna for it in custom]
    assert orden_default != orden_custom


def test_maximizar_peso_pm25_pone_arriba_a_la_comuna_con_peor_pm25():
    resumen, integracion, zonas = _cargar_poblacion()

    # PM2.5 promedio real más alto entre las comunas con dato PM2.5, calculado
    # directamente desde integracion_v2_pm25_arboles_medellin.csv (no asumido).
    por_comuna: dict[str, list[float]] = {}
    for fila in integracion:
        por_comuna.setdefault(fila.comuna, []).append(fila.pm25_promedio_ug_m3)
    promedios = {c: sum(v) / len(v) for c, v in por_comuna.items()}
    comuna_peor_pm25 = max(promedios, key=promedios.get)

    items = calcular_ranking_comunas(
        resumen, integracion, zonas, peso_pm25=1.0, peso_deficit=0.0, peso_area=0.0
    )
    assert items[0].comuna == comuna_peor_pm25
    assert items[0].ranking_prioridad == 1


def test_pesos_extremos_un_peso_en_cero_y_otro_en_uno_no_lanza_error():
    resumen, integracion, zonas = _cargar_poblacion()

    items = calcular_ranking_comunas(
        resumen, integracion, zonas, peso_pm25=0.0, peso_deficit=1.0, peso_area=0.0
    )
    assert len(items) > 0
    # Ordenado descendente por score_total.
    scores = [it.score_total for it in items]
    assert scores == sorted(scores, reverse=True)
    # Todos los scores deben estar en [0, 1] (combinación convexa de valores Min-Max en [0,1]).
    assert all(0.0 <= s <= 1.0 for s in scores)


def test_pesos_extremos_via_endpoint_no_lanza_error():
    resp = client.get(
        "/api/siembra/ranking-comunas",
        params={"peso_pm25": 0.0, "peso_deficit": 0.0, "peso_area": 1.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
