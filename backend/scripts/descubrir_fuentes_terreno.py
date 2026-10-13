"""Descubrimiento de fuentes de terreno/suelo/redes para Medellín (fase J1).

Recorre el catálogo ArcGIS REST de la Alcaldía (servidormapas), lista servicios y capas
con su geometría y campos, y marca las que parecen relevantes (redes de servicios,
geología, pendiente, amenaza, espacio público, zonas verdes, POT). Además consulta
catálogos abiertos (datos.gov.co, ArcGIS Hub) y sondea geoportales de EPM, IGAC y SGC.
Requiere internet: se ejecuta en GitHub Actions. No modifica datos del producto.

Uso: python scripts/descubrir_fuentes_terreno.py <directorio_salida>
"""
from __future__ import annotations

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

BASE = "https://www.medellin.gov.co/servidormapas/rest/services"
KEYWORDS = re.compile(
    r"alcantarill|acueduct|gas\b|gas_|electri|energ|red(es)?\b|servicio.?publico|"
    r"geolog|geomorf|suelo|pendiente|slope|dem\b|topograf|curva.?nivel|amenaza|riesgo|"
    r"movimiento|inundaci|susceptib|geotecn|hidro|quebrada|retiro|"
    r"espacio.?publico|anden|andén|perfil.?vial|malla.?vial|separador|zona.?verde|"
    r"arbol|arbor|cobertura|uso.?del.?suelo|pot\b|clasificaci|tratamiento|"
    r"epm|ambiente|dllo_sost|vivienda_ciudad|planeacion",
    re.I,
)
S = requests.Session()
S.headers["User-Agent"] = "EcoDataLab-discovery/1.0"


def get(url, params=None, timeout=40, tries=3):
    p = {"f": "json"}
    p.update(params or {})
    for i in range(tries):
        try:
            r = S.get(url, params=p, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            err = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            err = str(e)[:120]
        time.sleep(1.5 * (i + 1))
    return {"_error": err}


def listar_servicios():
    raiz = get(BASE)
    servicios = [(None, s["name"], s["type"]) for s in raiz.get("services", [])]
    for carpeta in raiz.get("folders", []):
        sub = get(f"{BASE}/{carpeta}")
        for s in sub.get("services", []):
            servicios.append((carpeta, s["name"], s["type"]))
    return raiz, servicios


def detalle_servicio(item):
    carpeta, nombre, tipo = item
    if tipo not in ("MapServer", "FeatureServer"):
        return {"carpeta": carpeta, "servicio": nombre, "tipo": tipo, "capas": []}
    url = f"{BASE}/{nombre}/{tipo}" if "/" in nombre else f"{BASE}/{nombre}/{tipo}"
    meta = get(url)
    capas = []
    for c in meta.get("layers", []):
        capas.append({"id": c["id"], "nombre": c["name"]})
    return {
        "carpeta": carpeta,
        "servicio": nombre,
        "tipo": tipo,
        "descripcion": (meta.get("serviceDescription") or meta.get("description") or "")[:300],
        "capas": capas,
        "_error": meta.get("_error"),
    }


def detalle_capa(args):
    try:
        return _detalle_capa(args)
    except Exception as e:  # noqa: BLE001
        return {"servicio": args[0], "id": args[2].get("id"), "nombre": args[2].get("nombre"), "_error": repr(e)[:200]}


def _detalle_capa(args):
    servicio, tipo, capa = args
    url = f"{BASE}/{servicio}/{tipo}/{capa['id']}"
    d = get(url)
    cnt = get(f"{url}/query", {"where": "1=1", "returnCountOnly": "true"})
    return {
        "servicio": servicio,
        "id": capa["id"],
        "nombre": capa["nombre"],
        "url": url,
        "geometria": d.get("geometryType"),
        "descripcion": (d.get("description") or "")[:300],
        "campos": [f["name"] for f in d.get("fields", [])][:60],
        "n_registros": cnt.get("count"),
        "max_registros_por_consulta": d.get("maxRecordCount"),
        "extent": d.get("extent"),
        "_error": d.get("_error"),
    }


def catalogos_abiertos(salida: Path):
    res = {}
    for q in ["alcantarillado medellin", "acueducto medellin", "arbolado medellin", "suelos antioquia", "amenaza movimiento en masa medellin"]:
        r = get("https://api.us.socrata.com/api/catalog/v1", {"domains": "www.datos.gov.co", "q": q, "limit": 10})
        res[f"socrata:{q}"] = [
            {"nombre": x["resource"].get("name"), "id": x["resource"].get("id"), "entidad": x["classification"].get("domain_metadata"), "link": x.get("link")}
            for x in r.get("results", [])
        ] if "results" in r else r
    for q in ["alcantarillado", "acueducto", "pendiente", "geologia", "espacio publico"]:
        r = get("https://hub.arcgis.com/api/v3/datasets", {"q": f"{q} medellin", "page[size]": 8})
        res[f"hub:{q}"] = [
            {"nombre": x.get("attributes", {}).get("name"), "url": x.get("attributes", {}).get("url"), "owner": x.get("attributes", {}).get("orgName")}
            for x in r.get("data", [])
        ] if "data" in r else r
    (salida / "catalogos_abiertos.json").write_text(json.dumps(res, ensure_ascii=False, indent=2))


def sondear_geoportales(salida: Path):
    urls = {
        "epm_geoportal": "https://www.epm.com.co/clientesyusuarios/geoportal/",
        "epm_instructivo": "https://www.epm.com.co/content/dam/epm/proveedores-y-contratistas/documentos/instructivo-para-la-referenciacion-de-sistemas-de-acueducto-y-alcantarillado.pdf",
        "igac_agrologia": "https://geoportal.igac.gov.co/contenido/datos-abiertos-agrologia",
        "sgc_geoportal": "https://srvags.sgc.gov.co/PortalWeb/Elementos-web/Geoportal/sistema/index.html",
        "geomedellin": "https://www.medellin.gov.co/irj/portal/medellin?NavigationTarget=contenido%2F6989-Geomedellin-el-portal-de-datos-geograficos-del-Municipio-de-Medellin",
        "plan_silvicultura": "https://www.medellin.gov.co/sau/manuales/PLAN%20DISTRITAL%20SILVICULTURA%20URBANA.pdf",
        "sgc_arcgis": "https://srvags.sgc.gov.co/arcgis/rest/services",
        "igac_arcgis": "https://geoportal.igac.gov.co/arcgis/rest/services",
        "epm_arcgis": "https://geoportal.epm.com.co/arcgis/rest/services",
    }
    res = {}
    for k, u in urls.items():
        try:
            r = S.get(u, timeout=60)
            res[k] = {"status": r.status_code, "content_type": r.headers.get("content-type"), "bytes": len(r.content)}
            if u.endswith(".pdf") and r.status_code == 200:
                (salida / f"{k}.pdf").write_bytes(r.content)
            elif r.status_code == 200 and "json" in (r.headers.get("content-type") or ""):
                res[k]["muestra"] = r.text[:1500]
            elif r.status_code == 200:
                texto = re.sub(r"<[^>]+>", " ", r.text)
                res[k]["muestra"] = re.sub(r"\s+", " ", texto)[:1500]
        except Exception as e:  # noqa: BLE001
            res[k] = {"error": str(e)[:200]}
    (salida / "geoportales.json").write_text(json.dumps(res, ensure_ascii=False, indent=2))


def main():
    salida = Path(sys.argv[1])
    salida.mkdir(parents=True, exist_ok=True)
    raiz, servicios = listar_servicios()
    print(f"{len(servicios)} servicios, carpetas: {raiz.get('folders')}")
    with ThreadPoolExecutor(8) as ex:
        detalles = list(ex.map(detalle_servicio, servicios))
    (salida / "catalogo_servicios.json").write_text(json.dumps(detalles, ensure_ascii=False, indent=1))

    candidatas = []
    for d in detalles:
        for c in d["capas"]:
            texto = f"{d['carpeta']} {d['servicio']} {c['nombre']}"
            if KEYWORDS.search(texto):
                candidatas.append((d["servicio"], d["tipo"], c))
    print(f"{len(candidatas)} capas candidatas")
    with ThreadPoolExecutor(8) as ex:
        capas = list(ex.map(detalle_capa, candidatas))
    (salida / "capas_candidatas.json").write_text(json.dumps(capas, ensure_ascii=False, indent=1))
    for fn in (catalogos_abiertos, sondear_geoportales):
        try:
            fn(salida)
        except Exception as e:  # noqa: BLE001
            print("fallo", fn.__name__, repr(e))
    print("listo")


if __name__ == "__main__":
    main()
