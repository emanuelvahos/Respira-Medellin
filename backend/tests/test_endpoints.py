"""Smoke tests de los endpoints principales de la API (FastAPI TestClient).

Usan los datasets reales de `backend/data/` ya presentes en el repo (no se
mockea ningún dato salvo en el test de 503, donde se simula explícitamente un
archivo faltante monkeypatcheando el loader correspondiente).
"""

from fastapi import HTTPException
from fastapi.testclient import TestClient

import app.routers.siembra as siembra_router
from app.main import app

client = TestClient(app)


def test_root_y_health():
    assert client.get("/").status_code == 200
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_get_comunas_geojson():
    resp = client.get("/api/comunas")
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) > 0
    nombres = {f["properties"]["nombre"] for f in data["features"]}
    assert "BELEN" in nombres


def test_get_resumen_comuna_siembra():
    resp = client.get("/api/siembra/resumen-comuna")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "comuna" in data[0]
    assert "ranking_prioridad" in data[0]


def test_ranking_comunas_get_pesos_por_defecto():
    resp = client.get("/api/siembra/ranking-comunas")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert data[0]["ranking_prioridad"] == 1
    # Score ordenado descendente.
    scores = [d["score_total"] for d in data]
    assert scores == sorted(scores, reverse=True)


def test_ranking_comunas_get_pesos_custom():
    resp = client.get(
        "/api/siembra/ranking-comunas",
        params={"peso_pm25": 0.2, "peso_deficit": 0.3, "peso_area": 0.5},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0


def test_ranking_comunas_pesos_invalidos_422():
    resp = client.get(
        "/api/siembra/ranking-comunas",
        params={"peso_pm25": 0.9, "peso_deficit": 0.9, "peso_area": 0.9},
    )
    assert resp.status_code == 422


def test_ranking_comunas_503_cuando_falta_el_dataset(monkeypatch):
    def _raise_503():
        raise HTTPException(status_code=503, detail="dataset simulado como ausente")

    monkeypatch.setattr(siembra_router, "load_resumen_recomendacion_comuna", _raise_503)

    resp = client.get("/api/siembra/ranking-comunas")
    assert resp.status_code == 503


def test_resumen_comuna_503_cuando_falta_el_dataset(monkeypatch):
    def _raise_503():
        raise HTTPException(status_code=503, detail="dataset simulado como ausente")

    monkeypatch.setattr(siembra_router, "load_resumen_recomendacion_comuna", _raise_503)

    resp = client.get("/api/siembra/resumen-comuna")
    assert resp.status_code == 503


def test_salud_resumen_comuna():
    resp = client.get("/api/salud/resumen-comuna")
    assert resp.status_code == 200
    data = resp.json()
    assert "metodologia" in data
    assert data["metodologia"]
