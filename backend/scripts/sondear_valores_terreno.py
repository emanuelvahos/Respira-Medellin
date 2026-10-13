"""Fase J1 (3.ª consulta, temporal): DEM/pendiente y redes de servicios de Medellín."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

B = "https://www.medellin.gov.co/servidormapas/rest/services"
S = requests.Session()
S.headers["User-Agent"] = "EcoDataLab-discovery/1.0"
PTS = {"poblado": (4716418.1, 2244747.25), "centro": (4715732.84, 2249506.84), "robledo": (4713534.57, 2252636.91)}


def get(url, params=None, tries=3):
    p = {"f": "json"}
    p.update(params or {})
    err = ""
    for i in range(tries):
        try:
            r = S.get(url, params=p, timeout=90)
            j = r.json() if r.status_code == 200 else {}
            if r.status_code == 200 and "error" not in j:
                return j
            err = json.dumps(j.get("error"))[:200] if j else f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            err = str(e)[:150]
        time.sleep(2 * (i + 1))
    return {"_error": err}


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    res = {"imagenes": {}}
    for nom in ("Modelo_digital_de_elevacion_medellin_2024", "Modelo_digital_de_elevacion_Medellin",
                "Modelo_digital_de_pendiente_gr_AMVA", "Modelo_digital_de_elevacion_AMVA"):
        url = f"{B}/ServiciosImagen/{nom}/ImageServer"
        m = get(url)
        d = {"extent": m.get("extent"), "pixel": m.get("pixelSizeX"), "sr": (m.get("spatialReference") or {}).get("wkid"),
             "serviceDescription": m.get("serviceDescription"), "copyright": m.get("copyrightText")}
        for k, (x, y) in PTS.items():
            d[k] = get(f"{url}/identify", {"geometry": json.dumps({"x": x, "y": y, "spatialReference": {"wkid": 9377}}),
                                           "geometryType": "esriGeometryPoint", "returnGeometry": "false",
                                           "returnCatalogItems": "false"}).get("value")
        res["imagenes"][nom] = d
        print(nom, d.get("poblado"), flush=True)
    r7 = f"{B}/ordenamiento_ter/VM_15_Subs_Servicios_Publicos/MapServer/7"
    res["redes"] = {
        "distinct_tipo": get(f"{r7}/query", {"where": "1=1", "outFields": "tipo_servicio", "returnDistinctValues": "true", "returnGeometry": "false"}),
        "distinct_elemento": get(f"{r7}/query", {"where": "1=1", "outFields": "elemento", "returnDistinctValues": "true", "returnGeometry": "false"}),
        "distinct_localizacion": get(f"{r7}/query", {"where": "1=1", "outFields": "localizacion", "returnDistinctValues": "true", "returnGeometry": "false"}),
    }
    for k, (x, y) in PTS.items():
        j = get(f"{r7}/query", {"geometry": json.dumps({"xmin": x - 150, "ymin": y - 150, "xmax": x + 150, "ymax": y + 150, "spatialReference": {"wkid": 9377}}),
                                "geometryType": "esriGeometryEnvelope", "spatialRel": "esriSpatialRelIntersects", "where": "1=1",
                                "outFields": "tipo_servicio,elemento,localizacion", "returnGeometry": "false", "inSR": 9377})
        res["redes"][f"cerca_{k}"] = [f["attributes"] for f in j.get("features", [])][:25] if "_error" not in j else j
    evu = f"{B}/ambiente_dllo_sost/VA_SistemaArbolUrbano_Base/MapServer/5"
    res["evu_narb"] = get(f"{evu}/query", {"where": "1=1", "groupByFieldsForStatistics": "narb_aprox", "returnGeometry": "false",
                                           "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "objectid", "outStatisticFieldName": "n"}])})
    ret = f"{B}/ordenamiento_ter/VM_04_Estructura_Ecologica_Principal/MapServer/8"
    res["retiros"] = get(f"{ret}/query", {"where": "1=1", "groupByFieldsForStatistics": "faja_retiro", "returnGeometry": "false",
                                          "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "objectid", "outStatisticFieldName": "n"}])})
    # Pendiente: histograma simple con 3 puntos más en laderas
    (out / "valores_capas.json").write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str))
    print("listo")


if __name__ == "__main__":
    main()
