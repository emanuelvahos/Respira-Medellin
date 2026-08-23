"""Tests para app/services/maduracion.py y GET /api/siembra/proyeccion (Fase F4)."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_loader import (
    load_diversificacion_especies_por_id,
    load_recomendacion_siembra_zona,
)
from app.services.maduracion import (
    ANIOS_MADURACION,
    calcular_proyeccion,
    factor_maduracion,
)

client = TestClient(app)


def test_factor_en_anio_cero_es_cercano_a_cero():
    for especie, anios in ANIOS_MADURACION.items():
        for escenario, _anio_mad in anios.items():
            assert factor_maduracion(0, especie, escenario) == pytest.approx(0.02)


def test_factor_en_anio_de_maduracion_es_90_por_ciento():
    for especie, anios in ANIOS_MADURACION.items():
        for escenario, anio_mad in anios.items():
            assert abs(factor_maduracion(anio_mad, especie, escenario) - 0.9) < 1e-6


def test_factor_es_monotono_creciente():
    for especie, anios in ANIOS_MADURACION.items():
        anio_mad = anios["esperado"]
        valores = [factor_maduracion(t, especie, "esperado") for t in range(0, anio_mad + 10, 2)]
        assert valores == sorted(valores)


def test_especie_desconocida_no_penaliza():
    assert factor_maduracion(0, "Especie inventada", "esperado") == 1.0


def test_calcular_proyeccion_pondera_diversificacion_por_zona():
    zonas = load_recomendacion_siembra_zona()
    diversificacion = load_diversificacion_especies_por_id()

    proyeccion = calcular_proyeccion(0, "esperado", zonas, diversificacion)
    assert proyeccion.factor_promedio_ciudad == 0.02  # todas las especies parten en 2% en el año 0
    assert proyeccion.n_zonas == len(zonas)
    # Verificado contra el reporte de investigación previo (Fase F4): 146
    # zonas con propuesta de diversificación real (Fase E3).
    assert proyeccion.n_zonas_con_diversificacion == 146
    assert proyeccion.arboles_cupo_estimado_total == sum(z.arboles_cupo_estimado for z in zonas)
    assert len(proyeccion.por_especie) == 5
    assert {c.comuna for c in proyeccion.por_comuna} == {z.comuna for z in zonas}


def test_calcular_proyeccion_a_madurez_total_se_acerca_a_90_por_ciento():
    zonas = load_recomendacion_siembra_zona()
    diversificacion = load_diversificacion_especies_por_id()
    # Año de maduración conservador más alto entre las 5 especies (Pino
    # Romerón, la más lenta): a ese punto, TODAS las especies ya alcanzaron
    # su propio 90%, así que el agregado ciudad también debe rondar 90%.
    anio_max = max(anios["conservador"] for anios in ANIOS_MADURACION.values())
    proyeccion = calcular_proyeccion(anio_max, "conservador", zonas, diversificacion)
    assert proyeccion.factor_promedio_ciudad > 0.89


def test_endpoint_proyeccion_default():
    resp = client.get("/api/siembra/proyeccion")
    assert resp.status_code == 200
    data = resp.json()
    assert data["anio"] == 0
    assert data["escenario"] == "esperado"
    assert data["factor_promedio_ciudad"] == 0.02
    assert len(data["caveats"]) == 6
    assert "formula" in data


def test_endpoint_proyeccion_escenario_custom():
    resp = client.get("/api/siembra/proyeccion", params={"anio": 15, "escenario": "conservador"})
    assert resp.status_code == 200
    assert resp.json()["escenario"] == "conservador"


def test_endpoint_proyeccion_escenario_invalido_422():
    resp = client.get("/api/siembra/proyeccion", params={"escenario": "no-existe"})
    assert resp.status_code == 422
