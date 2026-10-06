"""H1: perfila los árboles de la capa Contrato/5 (Medellín) que NO están en la
capa pública Ciudadano/1. No modifica datasets; escribe diagnostico_sau_perfil.json."""
from __future__ import annotations

import json
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE = "https://www.medellin.gov.co/servidormapas/rest/services/ambiente_dllo_sost"
CIU = f"{BASE}/VA_SistemaArbolUrbano_Ciudadano/MapServer/1"
CON = f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/5"
CAMPOS = ["objectid", "cod_individuo_disperso_amva", "municipio", "comuna", "barrio", "s_especie",
          "nombre_comun", "s_estado_individuo", "s_estado_arbol", "s_observaciones", "fecha_ingreso",
          "fecha_actualizacion", "id_contrato", "tipoarbol", "numero_intervenciones", "s_intervencion"]
OUT = Path(__file__).resolve().parents[1] / "data" / "diagnostico_sau_perfil.json"


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


def bajar(url, campos):
    meta = {c["name"] for c in get(url)["fields"]}
    usar = [c for c in campos if c in meta]
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
    return filas


def anio(ms):
    return datetime.fromtimestamp(ms / 1000, timezone.utc).year if ms else None


def main():
    ciu = bajar(CIU, ["objectid", "cod_individuo_disperso_amva", "municipio", "comuna", "s_estado_individuo"])
    en_ciu = {r["cod_individuo_disperso_amva"] for r in ciu if r.get("cod_individuo_disperso_amva")}
    con = bajar(CON, CAMPOS)
    # un registro por individuo: el de fecha_actualizacion más reciente
    uni = {}
    for r in con:
        c = r.get("cod_individuo_disperso_amva")
        if not c:
            continue
        if c not in uni or (r.get("fecha_actualizacion") or 0) > (uni[c].get("fecha_actualizacion") or 0):
            uni[c] = r
    med = {c: r for c, r in uni.items() if r.get("municipio") == "MEDELLÍN"}
    fuera = {c: r for c, r in med.items() if c not in en_ciu}
    dentro = {c: r for c, r in med.items() if c in en_ciu}

    def perfil(d):
        return {
            "n": len(d),
            "estado_individuo": dict(Counter(r.get("s_estado_individuo") for r in d.values())),
            "estado_arbol": dict(Counter(r.get("s_estado_arbol") for r in d.values())),
            "tipoarbol": dict(Counter(r.get("tipoarbol") for r in d.values())),
            "obs_top": Counter((r.get("s_observaciones") or "")[:60] for r in d.values()).most_common(15),
            "anio_ingreso": dict(sorted(Counter(anio(r.get("fecha_ingreso")) for r in d.values()).items(), key=lambda x: str(x[0]))),
            "anio_actualizacion": dict(sorted(Counter(anio(r.get("fecha_actualizacion")) for r in d.values()).items(), key=lambda x: str(x[0]))),
            "con_contrato": sum(1 for r in d.values() if r.get("id_contrato")),
            "sin_contrato": sum(1 for r in d.values() if not r.get("id_contrato")),
            "especies_top": Counter(r.get("s_especie") for r in d.values()).most_common(15),
            "intervencion_top": Counter(r.get("s_intervencion") for r in d.values()).most_common(8),
        }

    por_comuna = defaultdict(lambda: {"contrato_activos": 0, "contrato_total": 0, "ciudadano_activos": 0})
    for r in med.values():
        k = r.get("comuna") or "(sin comuna)"
        por_comuna[k]["contrato_total"] += 1
        if r.get("s_estado_individuo") == "Activo":
            por_comuna[k]["contrato_activos"] += 1
    for r in ciu:
        if r.get("municipio") == "MEDELLÍN" and r.get("s_estado_individuo") == "Activo":
            por_comuna[r.get("comuna") or "(sin comuna)"]["ciudadano_activos"] += 1

    inf = {
        "generado_utc": datetime.now(timezone.utc).isoformat(),
        "medellin_unicos_contrato": len(med),
        "medellin_activos_contrato": sum(1 for r in med.values() if r.get("s_estado_individuo") == "Activo"),
        "en_ciudadano": perfil(dentro),
        "solo_en_contrato": perfil(fuera),
        "por_comuna": dict(por_comuna),
    }
    OUT.write_text(json.dumps(inf, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print("ok", len(med), len(fuera))


if __name__ == "__main__":
    main()
