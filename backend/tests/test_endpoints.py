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


def test_resumen_comuna_incluye_comunas_sin_zona_de_siembra():
    """Las 4 comunas recalculadas (score AHP sin zona de siembra) deben venir
    marcadas explícitamente vía `fuente_score`/`tiene_zona_siembra`, y las 11
    originales deben seguir marcadas como `pipeline_original`/`True`."""
    resp = client.get("/api/siembra/resumen-comuna")
    assert resp.status_code == 200
    data = resp.json()

    por_comuna = {d["comuna"]: d for d in data}
    assert "Santa Cruz" in por_comuna
    assert por_comuna["Santa Cruz"]["fuente_score"] == "recalculo_zonas_verdes_reales"
    assert por_comuna["Santa Cruz"]["tiene_zona_siembra"] is False
    assert por_comuna["Santa Cruz"]["n_zonas_disponibles"] == 0

    assert por_comuna["Guayabal"]["fuente_score"] == "pipeline_original"
    assert por_comuna["Guayabal"]["tiene_zona_siembra"] is True

    sin_zona = {d["comuna"] for d in data if d["tiene_zona_siembra"] is False}
    assert sin_zona == {
        "Santa Cruz",
        "Villa Hermosa",
        "Corregimiento de San Cristóbal",
        "Corregimiento de Santa Elena",
        "Popular",
        "Manrique",
        "Doce de Octubre",
        "Corregimiento de Altavista",
    }


def test_resumen_comuna_incluye_comunas_con_pm25_interpolado_idw():
    """Popular, Manrique y Doce de Octubre no tienen ninguna estación SIATA
    real dentro de su polígono: su PM2.5 es un ESTIMADO por interpolación IDW,
    marcado explícitamente vía `pm25_tipo_dato`/`pm25_confianza`/
    `fuente_score`, distinto tanto de las 11 comunas con dato medido como de
    las 4 comunas recalculadas (que sí tienen PM2.5 medido)."""
    resp = client.get("/api/siembra/resumen-comuna")
    assert resp.status_code == 200
    data = resp.json()
    por_comuna = {d["comuna"]: d for d in data}

    for comuna in ["Popular", "Manrique", "Doce de Octubre"]:
        assert comuna in por_comuna, comuna
        fila = por_comuna[comuna]
        assert fila["fuente_score"] == "interpolado_idw"
        assert fila["pm25_tipo_dato"] == "interpolado"
        assert fila["pm25_confianza"] in {"media", "baja"}
        assert fila["pm25_distancia_estacion_mas_cercana_km"] is not None
        assert fila["pm25_distancia_estacion_mas_cercana_km"] > 0

    # Las 11 originales y las 4 recalculadas siguen con dato medido.
    assert por_comuna["Guayabal"]["pm25_tipo_dato"] == "medido"
    assert por_comuna["Guayabal"]["pm25_confianza"] is None
    assert por_comuna["Santa Cruz"]["pm25_tipo_dato"] == "medido"
    assert por_comuna["Santa Cruz"]["fuente_score"] == "recalculo_zonas_verdes_reales"

    # San Antonio de Prado/San Sebastián de Palmitas: sin score, sin PM2.5
    # (brecha real de monitoreo, ver docs/BRECHA_MONITOREO_AIRE.md).
    for comuna in [
        "Corregimiento de San Antonio de Prado",
        "Corregimiento de San Sebastián de Palmitas",
    ]:
        assert comuna not in por_comuna, comuna


def test_resumen_comuna_incluye_altavista_historico_no_vigente():
    """Altavista: PM2.5 REAL pero NO VIGENTE (estación MED-ALTA2, inactiva),
    cuarto nivel de confianza, marcado explícitamente vía
    `fuente_score="historico_no_vigente"` y `pm25_tipo_dato="historico"`,
    con `pm25_fecha_ultimo_dato` expuesto para el frontend."""
    resp = client.get("/api/siembra/resumen-comuna")
    assert resp.status_code == 200
    data = resp.json()
    por_comuna = {d["comuna"]: d for d in data}

    assert "Corregimiento de Altavista" in por_comuna
    fila = por_comuna["Corregimiento de Altavista"]
    assert fila["fuente_score"] == "historico_no_vigente"
    assert fila["pm25_tipo_dato"] == "historico"
    assert fila["pm25_promedio"] is not None
    assert fila["pm25_fecha_ultimo_dato"] == "2025-09-25"


def test_ranking_comunas_no_incluye_comunas_sin_zona_de_siembra():
    """El comparador AHP (`/ranking-comunas`) NO debe verse afectado por las
    comunas nuevas (recalculadas ni interpoladas): sigue devolviendo
    exactamente las 11 comunas originales."""
    resp = client.get("/api/siembra/ranking-comunas")
    assert resp.status_code == 200
    data = resp.json()
    comunas = {d["comuna"] for d in data}
    assert len(data) == 11
    assert "Santa Cruz" not in comunas
    assert "Villa Hermosa" not in comunas


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


def test_arboles_balance_expone_vivos_y_corte():
    resp = client.get("/api/arboles/balance")
    assert resp.status_code == 200
    data = resp.json()
    assert data["totales"]["vivos"] > 400_000
    assert data["fecha_actualizacion_max_fuente"]
    # el balance cuadra: cada individuo único cae en exactamente una categoría
    t = data["totales"]
    assert t["vivos"] + t["talados"] + t["desaparecidos"] + t["muertos"] + t["historicos"] + t["otros"] == t["individuos_unicos"]
    # y el resumen por comuna suma lo mismo que el total de vivos
    assert sum(c["vivos"] for c in data["por_comuna"].values()) == t["vivos"]


def test_arboles_resumen_comuna_coincide_con_balance():
    balance = client.get("/api/arboles/balance").json()
    resumen = client.get("/api/arboles/resumen-comuna").json()
    assert sum(r["total_arboles"] for r in resumen) == balance["totales"]["vivos"]
    # los árboles vivos no incluyen estados muerto/desaparecido
    estados = {e["estado"] for r in resumen for e in r["distribucion_estado"]}
    assert "Individuo Muerto" not in estados and "Individuo Desaparecido" not in estados


def test_ahp_v2_cubre_21_comunas_y_no_toca_v1():
    v2 = client.get("/api/siembra/ahp-v2").json()
    assert len(v2) == 21
    con_score = [c for c in v2 if c["score_v2_15"] is not None]
    assert len(con_score) == 15
    # las 11 comunas originales tienen score v1 y v2 comparables
    originales = [c for c in v2 if c["grupo"] == "original"]
    assert len(originales) == 11
    assert all(c["score_v1"] is not None and c["score_v2_11"] is not None for c in originales)
    # el ranking v1 (comparador) sigue exactamente igual que antes de v2
    v1 = client.get("/api/siembra/ranking-comunas").json()
    assert [c["comuna"] for c in v1][:2] == ["Guayabal", "Belén"]


def test_ahp_v2_resumen_y_conteos_sau():
    r = client.get("/api/siembra/ahp-v2/resumen").json()
    balance = client.get("/api/arboles/balance").json()
    assert r["arboles_vivos_sau_total_medellin"] == balance["totales"]["vivos"]
    assert -1.0 <= r["spearman_rank_v1_vs_v2_11"] <= 1.0
    v2 = client.get("/api/siembra/ahp-v2").json()
    assert sum(c["arboles_vivos_sau"] for c in v2) <= balance["totales"]["vivos"]


def test_arboles_comunas_detalle_coherente():
    det = client.get("/api/arboles/comunas-detalle").json()
    balance = client.get("/api/arboles/balance").json()
    assert len(det) == 21
    # suma = vivos del balance salvo individuos sin comuna asignada (pocos)
    assert 0 <= balance["totales"]["vivos"] - sum(c["arboles_vivos"] for c in det) < 100
    for c in det:
        assert c["razones"]
        if c["score_v2"] is None:
            assert "no tiene ningún dato de PM2.5" in c["razones"][0]
            assert c["contribucion"] is None
        else:
            k = c["contribucion"]
            assert abs(k["pm25"] + k["deficit"] + k["area"] - c["score_v2"]) < 0.01


def test_ndvi_por_comuna_y_correlacion():
    r = client.get("/api/arboles/ndvi").json()
    assert len(r["comunas"]) == 21
    assert sum(1 for c in r["comunas"] if c["es_urbana"]) == 16
    assert all(-1 <= c["ndvi_mediana"] <= 1 for c in r["comunas"])
    assert len(r["advertencias"]) >= 3
    for c in r["correlaciones"]:
        assert c["n_comunas"] == 16 and -1 <= c["spearman"] <= 1
