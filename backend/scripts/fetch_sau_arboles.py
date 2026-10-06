"""Descarga el inventario de árboles de Medellín desde el SAU (Alcaldía de Medellín).

H1 (2026-10): se cambió la fuente de la capa pública `Ciudadano/1` (foto de
octubre de 2023, 238.079 árboles de Medellín) a la capa operativa **Estado**:
`VA_SistemaArbolUrbano_Contrato/MapServer/3` ("Arboles Estado"), la más completa
y actualizada del mismo servidor público. Ver docs/H1_VERIFICACION_SAU.md.

Reglas (todas documentadas también en el balance JSON que se genera):
- Solo municipio MEDELLÍN (el servicio cubre los 10 municipios del Valle de Aburrá).
- Un registro por individuo (`cod_individuo_disperso_amva`): el de
  `fecha_actualizacion` más reciente (desempate por `objectid`).
- "Árbol vivo" = `s_estado_individuo == 'Activo'` y `s_estado_arbol` distinto de
  'Individuo Muerto' / 'Individuo Desaparecido'. Solo los vivos van al CSV que
  consume el backend; talados, desaparecidos, muertos e históricos se cuentan en
  `sau_arboles_balance.json` (transparencia: no se ocultan, no se cuentan).

Salidas (backend/data/):
- sau_arboles_urbanos.csv      árboles vivos (columnas livianas)
- sau_arboles_balance.json     totales por categoría y por comuna + metadatos de corte
- sau_comparacion_capas.json   (solo con --comparar-contrato) auditoría Estado vs Contrato

Servicio público sin autenticación; se descarga con throttling.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import requests

BASE = "https://www.medellin.gov.co/servidormapas/rest/services/ambiente_dllo_sost"
LAYER_ESTADO = f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/3"
LAYER_CONTRATO = f"{BASE}/VA_SistemaArbolUrbano_Contrato/MapServer/5"
MUNICIPIO = "MEDELLÍN"
PAGE_SIZE = 2000
DEFAULT_SLEEP_SECONDS = 0.5
MAX_RETRIES = 5
RETRY_BACKOFF_SECONDS = 3.0

ATTR_FIELDS = [
    "objectid",
    "cod_individuo_disperso_amva",
    "id_individuo_disperso",
    "s_especie",
    "nombre_comun",
    "tipoarbol",
    "s_estado_arbol",
    "s_estado_individuo",
    "municipio",
    "comuna",
    "barrio",
    "fecha_ingreso",
    "fecha_actualizacion",
]
# Columnas del CSV de árboles vivos (livianas: el backend en Render free tiene poca RAM).
CSV_FIELDS = [
    "objectid",
    "s_especie",
    "nombre_comun",
    "s_estado_arbol",
    "comuna",
    "barrio",
    "anio_ingreso",
    "lon",
    "lat",
]
ESTADOS_NO_VIVO = {"Individuo Muerto", "Individuo Desaparecido"}
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _get(session: requests.Session, url: str, params: dict) -> dict:
    last: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(url, params=params, timeout=90)
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                raise RuntimeError(str(data["error"]))
            return data
        except (requests.RequestException, ValueError, RuntimeError) as exc:
            last = exc
            wait = RETRY_BACKOFF_SECONDS * attempt
            print(f"  intento {attempt}/{MAX_RETRIES} falló ({exc}); reintento en {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError(f"Consulta fallida tras {MAX_RETRIES} intentos") from last


def _paginate(session, layer_url: str, fields: list[str], geometry: bool, sleep: float):
    """Itera filas {'attrs': {...}, 'coords': (lon, lat)|None} paginando por objectid."""
    where = f"municipio='{MUNICIPIO}'"
    offset = 0
    while True:
        params = {
            "where": where,
            "outFields": ",".join(fields),
            "orderByFields": "objectid",
            "resultOffset": offset,
            "resultRecordCount": PAGE_SIZE,
            "returnGeometry": "true" if geometry else "false",
            "f": "geojson" if geometry else "json",
        }
        data = _get(session, layer_url + "/query", params)
        feats = data.get("features", [])
        if not feats:
            return
        for f in feats:
            if geometry:
                g = (f.get("geometry") or {}).get("coordinates")
                coords = None
                if g:
                    pt = g[0] if isinstance(g[0], (list, tuple)) else g
                    coords = (pt[0], pt[1])
                yield {"attrs": f["properties"], "coords": coords}
            else:
                yield {"attrs": f["attributes"], "coords": None}
        if len(feats) < PAGE_SIZE and not data.get("exceededTransferLimit"):
            return
        offset += PAGE_SIZE
        time.sleep(sleep)


def _clave_actualizacion(attrs: dict) -> tuple:
    return (attrs.get("fecha_actualizacion") or 0, attrs.get("objectid") or 0)


def _anio(ms) -> int | None:
    return datetime.fromtimestamp(ms / 1000, timezone.utc).year if ms else None


def es_vivo(attrs: dict) -> bool:
    return attrs.get("s_estado_individuo") == "Activo" and attrs.get("s_estado_arbol") not in ESTADOS_NO_VIVO


def categoria(attrs: dict) -> str:
    ind = attrs.get("s_estado_individuo")
    arb = attrs.get("s_estado_arbol")
    if ind == "Talado":
        return "talado"
    if ind == "Historico":
        return "historico"
    if ind == "Desaparecido" or arb == "Individuo Desaparecido":
        return "desaparecido"
    if arb == "Individuo Muerto":
        return "muerto"
    if ind == "Activo":
        return "vivo"
    return "otro"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out-dir", type=Path, default=DATA_DIR)
    ap.add_argument("--sleep", type=float, default=DEFAULT_SLEEP_SECONDS)
    ap.add_argument("--comparar-contrato", action="store_true",
                    help="Descarga también Contrato/5 (solo atributos) y escribe sau_comparacion_capas.json")
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers["User-Agent"] = "ecodata-lab-medellin-etl/2.0 (uso academico/investigacion)"

    print("Descargando capa Estado (Medellín)...", flush=True)
    por_cod: dict[str, dict] = {}
    sin_cod = 0
    filas = 0
    filas_por_cod: Counter = Counter()
    for fila in _paginate(session, LAYER_ESTADO, ATTR_FIELDS, True, args.sleep):
        filas += 1
        a = fila["attrs"]
        cod = a.get("cod_individuo_disperso_amva")
        if not cod:
            sin_cod += 1
            cod = f"__sin_cod_{a.get('objectid')}"
        filas_por_cod[cod] += 1
        prev = por_cod.get(cod)
        if prev is None or _clave_actualizacion(a) > _clave_actualizacion(prev["attrs"]):
            por_cod[cod] = fila
        if filas % 50000 == 0:
            print(f"  {filas} filas...", flush=True)

    duplicados = sum(1 for n in filas_por_cod.values() if n > 1)
    print(f"Filas: {filas} | individuos únicos: {len(por_cod)} | con 2+ filas: {duplicados}", flush=True)

    conteos = Counter()
    por_comuna: dict[str, Counter] = defaultdict(Counter)
    max_act = 0
    vivos_rows = []
    sin_coords = 0
    for fila in por_cod.values():
        a = fila["attrs"]
        cat = categoria(a)
        conteos[cat] += 1
        por_comuna[a.get("comuna") or "(sin comuna)"][cat] += 1
        max_act = max(max_act, a.get("fecha_actualizacion") or 0)
        if cat == "vivo":
            if not fila["coords"]:
                sin_coords += 1
                continue
            vivos_rows.append(
                {
                    "objectid": a["objectid"],
                    "s_especie": a.get("s_especie"),
                    "nombre_comun": a.get("nombre_comun"),
                    "s_estado_arbol": a.get("s_estado_arbol"),
                    "comuna": a.get("comuna"),
                    "barrio": a.get("barrio"),
                    "anio_ingreso": _anio(a.get("fecha_ingreso")),
                    "lon": round(fila["coords"][0], 6),
                    "lat": round(fila["coords"][1], 6),
                }
            )

    vivos_rows.sort(key=lambda r: r["objectid"])
    out_csv = args.out_dir / "sau_arboles_urbanos.csv"
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        w.writeheader()
        w.writerows(vivos_rows)

    balance = {
        "fuente": {
            "nombre": "Sistema de Árbol Urbano (SAU) — Alcaldía de Medellín",
            "servicio": "VA_SistemaArbolUrbano_Contrato/MapServer/3 (Arboles Estado)",
            "url": LAYER_ESTADO,
            "municipio": MUNICIPIO,
        },
        "fecha_descarga_utc": datetime.now(timezone.utc).isoformat(),
        "fecha_actualizacion_max_fuente": datetime.fromtimestamp(max_act / 1000, timezone.utc).date().isoformat()
        if max_act
        else None,
        "criterio_arbol_vivo": (
            "s_estado_individuo = 'Activo' y s_estado_arbol distinto de 'Individuo Muerto' "
            "y 'Individuo Desaparecido'; un registro por individuo (el más reciente)."
        ),
        "totales": {
            "filas_descargadas": filas,
            "individuos_unicos": len(por_cod),
            "individuos_con_varias_filas": duplicados,
            "filas_sin_codigo_individuo": sin_cod,
            "vivos": conteos["vivo"],
            "vivos_sin_geometria": sin_coords,
            "talados": conteos["talado"],
            "desaparecidos": conteos["desaparecido"],
            "muertos": conteos["muerto"],
            "historicos": conteos["historico"],
            "otros": conteos["otro"],
        },
        "por_comuna": {
            c: {
                "vivos": v["vivo"],
                "talados": v["talado"],
                "desaparecidos": v["desaparecido"],
                "muertos": v["muerto"],
                "historicos": v["historico"],
                "total_registrados": sum(v.values()),
            }
            for c, v in sorted(por_comuna.items(), key=lambda kv: -kv[1]["vivo"])
        },
    }
    (args.out_dir / "sau_arboles_balance.json").write_text(
        json.dumps(balance, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Guardado {out_csv} ({len(vivos_rows)} árboles vivos)")
    print(json.dumps(balance["totales"], ensure_ascii=False, indent=2))

    if args.comparar_contrato:
        print("Descargando capa Contrato (Medellín, atributos) para auditoría...", flush=True)
        con: dict[str, dict] = {}
        for fila in _paginate(session, LAYER_CONTRATO, ATTR_FIELDS, False, args.sleep):
            a = fila["attrs"]
            cod = a.get("cod_individuo_disperso_amva")
            if cod and (cod not in con or _clave_actualizacion(a) > _clave_actualizacion(con[cod])):
                con[cod] = a
        est = {c: f["attrs"] for c, f in por_cod.items() if not c.startswith("__sin_cod_")}
        solo_est = set(est) - set(con)
        solo_con = set(con) - set(est)
        ambos = set(est) & set(con)
        comp = {
            "individuos_estado": len(est),
            "individuos_contrato": len(con),
            "en_ambos": len(ambos),
            "solo_en_estado": len(solo_est),
            "solo_en_contrato": len(solo_con),
            "solo_en_estado_por_categoria": dict(Counter(categoria(est[c]) for c in solo_est)),
            "solo_en_contrato_por_categoria": dict(Counter(categoria(con[c]) for c in solo_con)),
            "vivos_estado": sum(1 for c in est if es_vivo(est[c])),
            "vivos_contrato": sum(1 for c in con if es_vivo(con[c])),
            "en_ambos_distinto_estado_arbol": sum(
                1 for c in ambos if est[c].get("s_estado_arbol") != con[c].get("s_estado_arbol")
            ),
            "en_ambos_distinto_estado_individuo": sum(
                1 for c in ambos if est[c].get("s_estado_individuo") != con[c].get("s_estado_individuo")
            ),
            "en_ambos_vivo_en_contrato_no_vivo_en_estado": sum(
                1 for c in ambos if es_vivo(con[c]) and not es_vivo(est[c])
            ),
        }
        (args.out_dir / "sau_comparacion_capas.json").write_text(
            json.dumps(comp, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(comp, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
