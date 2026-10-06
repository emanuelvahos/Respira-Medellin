"""H1: cuenta individuos ÚNICOS en cada capa del SAU (pagina solo identificadores,
sin geometría). No modifica datasets; escribe backend/data/diagnostico_sau_unicos.json."""
from __future__ import annotations

import json
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE = "https://www.medellin.gov.co/servidormapas/rest/services/ambiente_dllo_sost"
CAPAS = {
    "ciudadano_1": f"{BASE}/VA_SistemaArbolUrbano_Ciudadano/MapServer/1",
    "sincronizado_0": f"{BASE}/VA_SistemaArbolUrbano_sincronizado/MapServer/0",
    "contrato_5": f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/5",
    "contrato_3": f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/3",
}
WANT = ["objectid", "cod_individuo_disperso_amva", "id_individuo_disperso", "municipio",
        "s_estado_individuo", "s_estado_arbol", "numero_intervenciones", "fecha_actualizacion"]
OUT = Path(__file__).resolve().parents[1] / "data" / "diagnostico_sau_unicos.json"


def get(url, **p):
    p.setdefault("f", "json")
    err = None
    for i in range(6):
        try:
            r = requests.get(url, params=p, timeout=90)
            r.raise_for_status()
            j = r.json()
            if "error" in j:
                raise RuntimeError(str(j["error"]))
            return j
        except Exception as e:  # noqa: BLE001
            err = str(e)
            time.sleep(3 * (i + 1))
    raise RuntimeError(err)


def bajar(url):
    meta = get(url)
    campos = [c["name"] for c in meta["fields"]]
    usar = [c for c in WANT if c in campos]
    filas, off = [], 0
    while True:
        j = get(f"{url}/query", where="1=1", outFields=",".join(usar), returnGeometry="false",
                orderByFields="objectid", resultOffset=off, resultRecordCount=2000)
        feats = j.get("features", [])
        filas += [f["attributes"] for f in feats]
        if len(feats) < 2000 and not j.get("exceededTransferLimit"):
            break
        off += 2000
        time.sleep(0.3)
    return usar, filas


def resumen(filas):
    cod = Counter(r.get("cod_individuo_disperso_amva") for r in filas if r.get("cod_individuo_disperso_amva"))
    key = {(r.get("municipio"), r.get("id_individuo_disperso")) for r in filas if r.get("id_individuo_disperso") is not None}
    por_mun = {}
    for r in filas:
        c = r.get("cod_individuo_disperso_amva")
        if c:
            por_mun.setdefault(r.get("municipio"), set()).add(c)
    # estado "más reciente" por individuo no es determinable sin fecha de evento; se reporta distribución por fila
    return {
        "filas": len(filas),
        "unicos_por_cod_amva": len(cod),
        "unicos_por_municipio_id": len(key),
        "filas_sin_cod": sum(1 for r in filas if not r.get("cod_individuo_disperso_amva")),
        "max_filas_por_individuo": max(cod.values()) if cod else None,
        "unicos_por_municipio": {str(k): len(v) for k, v in por_mun.items()},
        "filas_por_estado_individuo": dict(Counter(r.get("s_estado_individuo") for r in filas)),
        "filas_por_estado_arbol": dict(Counter(r.get("s_estado_arbol") for r in filas)),
    }, set(cod)


def main():
    inf = {"generado_utc": datetime.now(timezone.utc).isoformat(), "capas": {}}
    sets = {}
    for nombre, url in CAPAS.items():
        t = time.time()
        usar, filas = bajar(url)
        res, s = resumen(filas)
        res["campos_usados"] = usar
        res["segundos"] = round(time.time() - t)
        inf["capas"][nombre] = res
        sets[nombre] = s
        OUT.write_text(json.dumps(inf, ensure_ascii=False, indent=2), encoding="utf-8")
        print(nombre, res["filas"], res["unicos_por_cod_amva"], flush=True)
    base = sets["ciudadano_1"]
    inf["cruces_contra_ciudadano_1"] = {
        n: {"en_ambos": len(s & base), "solo_en_esa_capa": len(s - base), "solo_en_ciudadano": len(base - s)}
        for n, s in sets.items() if n != "ciudadano_1"
    }
    OUT.write_text(json.dumps(inf, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
