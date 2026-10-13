"""Fase J1 (2.ª consulta): valores reales de capas de terreno/redes de Medellín.

Para cada capa clave calcula distribuciones por campo categórico, estadísticos de campos
numéricos y fecha de actualización. Requiere internet (GitHub Actions). No modifica datos.
Uso: python scripts/sondear_valores_terreno.py <directorio_salida>
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import requests

B = "https://www.medellin.gov.co/servidormapas/rest/services"
S = requests.Session()
S.headers["User-Agent"] = "EcoDataLab-discovery/1.0"

# (clave, ruta, campos categóricos, campos numéricos, campo fecha)
CAPAS = [
    ("redes_servicios", "ordenamiento_ter/VM_15_Subs_Servicios_Publicos/MapServer/7", ["tipo_servicio", "elemento", "localizacion"], ["shape_length"], "fecha_actualizacion"),
    ("influencia_redes_tension", "ambiente_dllo_sost/VA_SistemaArbolUrbano_Contrato/MapServer/6", ["tension_tipo", "tipo_red", "estado", "material", "comuna"], ["buff_dist", "tension"], None),
    ("amenaza_mov_masa", "ambiente_dllo_sost/VA_DGRD/MapServer/6", ["categoria", "grado_amenaza"], ["st_area(shape)"], "fecha_actualizacion"),
    ("amenaza_inundacion", "ambiente_dllo_sost/VA_DGRD/MapServer/5", ["categoria", "grado_amenaza"], [], "fecha_actualizacion"),
    ("amenaza_torrencial", "ambiente_dllo_sost/VA_DGRD/MapServer/4", ["categoria", "grado_amenaza"], [], "fecha_actualizacion"),
    ("riesgo_mov_masa", "ambiente_dllo_sost/VA_DGRD/MapServer/9", ["riesgo", "tipo_amenaza"], [], "fecha_actualizacion"),
    ("geologia", "ambiente_dllo_sost/VM_DAGRD/MapServer/0", ["unidad"], [], None),
    ("anden", "mapas_nacionales/VC_Infraestructura_Fisica/MapServer/0", ["estado", "material", "obstaculo", "homogeneo"], ["ancho", "altura", "longitud"], None),
    ("evu", "ambiente_dllo_sost/VA_SistemaArbolUrbano_Base/MapServer/5", ["clasefuncional", "cobertura", "infraestructura", "condicion", "propiedad", "cubierta_verde", "sistema_pmepvu", "fuente_inf"], ["narb_aprox", "area_ha"], None),
    ("poste", "vivienda_ciudad_terri/VM_Alumbrado_Publico/MapServer/1", ["estado", "material", "clase", "propietari"], ["altura"], None),
    ("uso_suelo_urbano", "ordenamiento_ter/VA_POT48_Reporte_UsoSuelo_U/MapServer/20", ["subcategoria", "areagraluso"], [], "fecha_actualizacion"),
    ("retiros_hidricos", "ambiente_dllo_sost/VM_04_Estructura_Ecologica_Principal/MapServer/8", ["categoria_proteccion", "subcategoria_proteccion"], ["faja_retiro"], None),
]


def get(url, params=None, tries=3):
    p = {"f": "json"}
    p.update(params or {})
    err = ""
    for i in range(tries):
        try:
            r = S.get(url, params=p, timeout=90)
            if r.status_code == 200:
                j = r.json()
                if "error" not in j:
                    return j
                err = json.dumps(j["error"])[:200]
            else:
                err = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            err = str(e)[:150]
        time.sleep(2 * (i + 1))
    return {"_error": err}


def dist(url, campo):
    j = get(f"{url}/query", {
        "where": "1=1", "groupByFieldsForStatistics": campo, "returnGeometry": "false",
        "outStatistics": json.dumps([{"statisticType": "count", "onStatisticField": "objectid", "outStatisticFieldName": "n"}]),
    })
    if "_error" in j:
        return j
    filas = [(f["attributes"].get(campo), f["attributes"].get("n")) for f in j.get("features", [])]
    filas.sort(key=lambda t: -(t[1] or 0))
    return filas[:40]


def estad(url, campo):
    stats = [{"statisticType": t, "onStatisticField": campo, "outStatisticFieldName": t}
             for t in ("min", "max", "avg", "sum")]
    j = get(f"{url}/query", {"where": "1=1", "outStatistics": json.dumps(stats), "returnGeometry": "false"})
    if "_error" in j:
        return j
    return (j.get("features") or [{}])[0].get("attributes")


def fecha_max(url, campo):
    j = get(f"{url}/query", {
        "where": "1=1", "returnGeometry": "false",
        "outStatistics": json.dumps([{"statisticType": "max", "onStatisticField": campo, "outStatisticFieldName": "m"},
                                     {"statisticType": "min", "onStatisticField": campo, "outStatisticFieldName": "mn"}]),
    })
    if "_error" in j:
        return j
    a = (j.get("features") or [{}])[0].get("attributes") or {}
    f = lambda v: time.strftime("%Y-%m-%d", time.gmtime(v / 1000)) if v else None  # noqa: E731
    return {"max": f(a.get("m")), "min": f(a.get("mn"))}


def prueba_punto(url):
    """Consulta espacial por un punto de El Poblado (WGS84) para validar el método."""
    j = get(f"{url}/query", {
        "geometry": "-75.5636,6.2088", "geometryType": "esriGeometryPoint", "inSR": 4326,
        "spatialRel": "esriSpatialRelIntersects", "where": "1=1", "outFields": "*",
        "returnGeometry": "false", "resultRecordCount": 3,
    })
    if "_error" in j:
        return j
    return [f["attributes"] for f in j.get("features", [])]


def main():
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    res = {}
    for clave, ruta, cats, nums, fecha in CAPAS:
        url = f"{B}/{ruta}"
        d = {"url": url}
        try:
            meta = get(url)
            d["campos"] = [(f["name"], f["type"]) for f in meta.get("fields", [])] if "_error" not in meta else meta
            d["maxRecordCount"] = meta.get("maxRecordCount")
            d["cat"] = {c: dist(url, c) for c in cats}
            d["num"] = {n: estad(url, n) for n in nums}
            if fecha:
                d["fecha"] = fecha_max(url, fecha)
            d["punto_poblado"] = prueba_punto(url)
        except Exception as e:  # noqa: BLE001
            d["_error"] = repr(e)[:200]
        res[clave] = d
        print(clave, "ok" if "_error" not in d else d["_error"], flush=True)
    # Relieve y cotas: buscar capas de elevación
    rel = {}
    for ruta in ("mapas_nacionales/VC_Relieve/MapServer", "Hosted/COTAS5M/FeatureServer", "ServiciosImagen"):
        rel[ruta] = get(f"{B}/{ruta}")
    res["relieve"] = {k: (v if "_error" in v else {"layers": [(l["id"], l["name"]) for l in v.get("layers", [])],
                                                     "services": [s["name"] for s in v.get("services", [])]})
                      for k, v in rel.items()}
    # Modelos digitales (DEM / pendiente): metadatos + valor en un punto de El Poblado (WGS84)
    dem = {}
    for nom in ("Modelo_digital_de_elevacion_medellin_2024", "Modelo_digital_de_elevacion_Medellin",
                "Modelo_digital_de_elevacion_AMVA", "Modelo_digital_de_pendiente_gr_AMVA"):
        url = f"{B}/ServiciosImagen/{nom}/ImageServer"
        m = get(url)
        info = {k: m.get(k) for k in ("description", "pixelSizeX", "pixelSizeY", "bandCount", "pixelType", "extent", "minValues", "maxValues", "meanValues")} if "_error" not in m else m
        ident = get(f"{url}/identify", {"geometry": "-75.5636,6.2088", "geometryType": "esriGeometryPoint",
                                          "sr": 4326, "returnGeometry": "false"})
        info["identify_poblado"] = ident
        dem[nom] = info
    res["dem"] = dem
    (out / "valores_capas.json").write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str))
    print("listo")


if __name__ == "__main__":
    main()
