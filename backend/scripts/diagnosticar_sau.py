"""Diagnóstico del servicio ArcGIS del SAU (Alcaldía de Medellín).

Objetivo (fase H1): entender por qué nuestra descarga tiene ~339.724 árboles
cuando la Alcaldía comunica ~470.000-490.000. NO modifica ningún dataset:
solo escribe backend/data/diagnostico_sau.json con conteos y metadatos.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE = "https://www.medellin.gov.co/servidormapas/rest/services/ambiente_dllo_sost"
SERVICE = f"{BASE}/VA_SistemaArbolUrbano_Ciudadano/MapServer"
OUT = Path(__file__).resolve().parents[1] / "data" / "diagnostico_sau.json"


def get(url: str, **params):
    params.setdefault("f", "json")
    for intento in range(4):
        try:
            r = requests.get(url, params=params, timeout=60)
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa: BLE001
            err = str(exc)
            time.sleep(3 * (intento + 1))
    return {"error": err}


def stats_por(layer_url: str, campo: str):
    resp = get(
        f"{layer_url}/query",
        where="1=1",
        outFields=campo,
        groupByFieldsForStatistics=campo,
        outStatistics=json.dumps(
            [{"statisticType": "count", "onStatisticField": "objectid", "outStatisticFieldName": "n"}]
        ),
        returnGeometry="false",
    )
    if "features" not in resp:
        return resp
    return {str(f["attributes"].get(campo)): f["attributes"]["n"] for f in resp["features"]}


def main() -> int:
    informe: dict = {
        "generado_utc": datetime.now(timezone.utc).isoformat(),
        "servicio": SERVICE,
    }
    carpeta = get(BASE)
    informe["servicios_en_carpeta"] = [s.get("name") for s in carpeta.get("services", [])]

    raiz = get(SERVICE)
    informe["raiz"] = {
        "description": raiz.get("serviceDescription"),
        "maxRecordCount": raiz.get("maxRecordCount"),
        "layers": raiz.get("layers"),
        "tables": raiz.get("tables"),
        "error": raiz.get("error"),
    }

    capas = {}
    for lyr in raiz.get("layers", []) or []:
        url = f"{SERVICE}/{lyr['id']}"
        meta = get(url)
        cnt = get(f"{url}/query", where="1=1", returnCountOnly="true")
        capas[lyr["id"]] = {
            "name": lyr.get("name"),
            "geometryType": meta.get("geometryType"),
            "campos": [c["name"] for c in meta.get("fields", [])],
            "definitionExpression": meta.get("definitionExpression"),
            "count": cnt.get("count", cnt),
        }
    informe["capas"] = capas

    otros = {}
    for nombre in [
        "VA_SistemaArbolUrbano_Base",
        "VA_SistemaArbolUrbano_App",
        "VA_SistemaArbolUrbano_AreaForestal",
        "VA_SistemaArbolUrbano_sincronizado",
        "VA_SistemaArbolUrbano_Ciudadano_app",
        "VA_SistemaArbolUrbano_Contrato",
    ]:
        for tipo in ("MapServer", "FeatureServer"):
            svc = f"{BASE}/{nombre}/{tipo}"
            meta = get(svc)
            if "layers" not in meta:
                continue
            otros[f"{nombre}/{tipo}"] = {}
            for lyr in meta["layers"]:
                c = get(f"{svc}/{lyr['id']}/query", where="1=1", returnCountOnly="true")
                otros[f"{nombre}/{tipo}"][f"{lyr['id']}:{lyr.get('name')}"] = c.get("count", c)
            break
    informe["otros_servicios_sau"] = otros

    detalle = {}
    for etiqueta, url in {
        "sincronizado_0": f"{BASE}/VA_SistemaArbolUrbano_sincronizado/MapServer/0",
        "contrato_5": f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/5",
        "contrato_3": f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/3",
        "contrato_4": f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/4",
        "evu_5": f"{BASE}/VA_SistemaArbolUrbano_Base/MapServer/5",
    }.items():
        meta = get(url)
        campos = [c["name"] for c in meta.get("fields", [])]
        muestra = get(f"{url}/query", where="1=1", outFields="*", resultRecordCount="2", returnGeometry="false")
        d = {"nombre": meta.get("name"), "tipo": meta.get("type"), "campos": campos,
             "muestra": [f.get("attributes") for f in muestra.get("features", [])] if "features" in muestra else muestra}
        for cand in ("municipio", "s_estado_individuo", "s_estado_arbol", "estado", "s_estado", "tipo_elemento", "tipo_cobertura"):
            real = next((c for c in campos if c.lower() == cand), None)
            if real:
                d["por_" + real] = stats_por(url, real)
        detalle[etiqueta] = d
    informe["detalle_otros"] = detalle

    capa1 = f"{SERVICE}/1"
    informe["capa1_count"] = get(f"{capa1}/query", where="1=1", returnCountOnly="true")
    informe["capa1_por_estado_individuo"] = stats_por(capa1, "s_estado_individuo")
    informe["capa1_por_estado_arbol"] = stats_por(capa1, "s_estado_arbol")
    informe["capa1_por_municipio"] = stats_por(capa1, "municipio")
    informe["capa1_por_tipoarbol"] = stats_por(capa1, "tipoarbol")
    informe["capa1_por_comuna"] = stats_por(capa1, "comuna")
    mx = get(
        f"{capa1}/query",
        where="1=1",
        outStatistics=json.dumps(
            [
                {"statisticType": "max", "onStatisticField": "fecha_actualizacion", "outStatisticFieldName": "max_act"},
                {"statisticType": "max", "onStatisticField": "fecha_ingreso", "outStatisticFieldName": "max_ing"},
            ]
        ),
    )
    informe["capa1_fechas_max_ms"] = mx.get("features", mx)

    OUT.write_text(json.dumps(informe, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(informe, ensure_ascii=False, indent=2)[:6000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
