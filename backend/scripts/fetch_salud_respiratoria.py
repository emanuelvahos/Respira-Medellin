"""Descarga (agregada, no cruda) diagnósticos respiratorios por comuna desde Metrosalud.

Fuente: "Perfil de morbilidad de la ESE Metrosalud" (datos.gov.co, API Socrata,
id `pypc-7h3w`) — ver exploración previa. >1.04M filas crudas de atenciones
individuales; este script NUNCA descarga esas filas. En su lugar hace 3
consultas SoQL agregadas del lado del servidor (justo para lo que Socrata
expone `$select`/`$where`/`$group`), y guarda solo el resultado agregado
(pequeño, unas pocas KB) en `backend/data/salud_respiratoria_resumen_comuna.json`.

SESGO METODOLÓGICO (no opcional, debe preservarse hasta la UI): Metrosalud es
la red pública/régimen subsidiado de Medellín — no cubre pacientes de EPS del
régimen contributivo atendidos en clínicas privadas. El sesgo hacia comunas de
menor estrato refleja composición de la población atendida, no
necesariamente incidencia real de enfermedad. Es un proxy de "carga
respiratoria en la red pública", NO la morbilidad respiratoria total de la
ciudad. Ese texto se guarda tal cual en el JSON de salida (campo
`metodologia`) para que viaje con el dato en cualquier consumidor futuro, no
solo en este docstring.

Uso:
    python backend/scripts/fetch_salud_respiratoria.py
"""

from __future__ import annotations

import argparse
import json
import time
from collections import defaultdict
from pathlib import Path

import requests

SOCRATA_BASE_URL = "https://www.datos.gov.co/resource/pypc-7h3w.json"
RESPIRATORIO_WHERE = "codigo_diagnostico_principal like 'J%' AND comuna IS NOT NULL"
TOP_DIAGNOSTICOS_POR_COMUNA = 5
MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = 5.0

METODOLOGIA = (
    "Fuente: red pública Metrosalud (régimen subsidiado), no la morbilidad "
    "respiratoria total de Medellín. Metrosalud no cubre pacientes de EPS del "
    "régimen contributivo atendidos en clínicas privadas; el sesgo hacia "
    "comunas de menor estrato refleja composición de la población atendida, "
    "no necesariamente mayor incidencia real de enfermedad. Diagnósticos "
    "CIE-10 J00-J99 (enfermedades del sistema respiratorio)."
)


def _get_with_retries(session: requests.Session, params: dict) -> list[dict]:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        resp = session.get(SOCRATA_BASE_URL, params=params, timeout=60)
        if resp.status_code == 429:
            wait = RETRY_BACKOFF_SECONDS * attempt
            print(f"  429 (throttled), reintentando en {wait:.0f}s...")
            time.sleep(wait)
            continue
        try:
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last_exc = exc
            wait = RETRY_BACKOFF_SECONDS * attempt
            print(f"  intento {attempt}/{MAX_RETRIES} falló ({exc}); reintentando en {wait:.0f}s...")
            time.sleep(wait)
    raise RuntimeError(f"Consulta a Socrata falló tras {MAX_RETRIES} intentos") from last_exc


def fetch_total_por_comuna(session: requests.Session) -> dict[str, int]:
    rows = _get_with_retries(
        session,
        {
            "$select": "comuna,count(*) as total",
            "$where": RESPIRATORIO_WHERE,
            "$group": "comuna",
            "$order": "total DESC",
            "$limit": 200,
        },
    )
    return {r["comuna"]: int(r["total"]) for r in rows}


def fetch_por_anio(session: requests.Session) -> dict[str, dict[str, int]]:
    """{comuna: {anio: total}} — usa date_extract_y(fecha) porque el dataset
    fuente no trae una columna `anio` propia (solo `a_o_mes` como texto y `fecha`)."""
    rows = _get_with_retries(
        session,
        {
            "$select": "comuna,date_extract_y(fecha) as anio,count(*) as total",
            "$where": RESPIRATORIO_WHERE,
            "$group": "comuna,anio",
            "$order": "comuna,anio",
            "$limit": 2000,
        },
    )
    resultado: dict[str, dict[str, int]] = defaultdict(dict)
    for r in rows:
        resultado[r["comuna"]][str(int(r["anio"]))] = int(r["total"])
    return dict(resultado)


def fetch_top_diagnosticos(session: requests.Session) -> dict[str, list[dict]]:
    """Socrata no soporta "top N por grupo" nativo: se piden todos los pares
    comuna+diagnóstico ordenados por conteo, y se recorta a los primeros N por
    comuna en Python."""
    rows = _get_with_retries(
        session,
        {
            "$select": (
                "comuna,codigo_diagnostico_principal,nombre_diagnostico_principal,"
                "count(*) as total"
            ),
            "$where": RESPIRATORIO_WHERE + " AND nombre_diagnostico_principal IS NOT NULL",
            "$group": "comuna,codigo_diagnostico_principal,nombre_diagnostico_principal",
            "$order": "comuna,total DESC",
            "$limit": 5000,
        },
    )
    por_comuna: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        comuna = r["comuna"]
        if len(por_comuna[comuna]) >= TOP_DIAGNOSTICOS_POR_COMUNA:
            continue
        por_comuna[comuna].append(
            {
                "codigo": r["codigo_diagnostico_principal"],
                "nombre": r["nombre_diagnostico_principal"],
                "cantidad": int(r["total"]),
            }
        )
    return dict(por_comuna)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "salud_respiratoria_resumen_comuna.json",
    )
    args = parser.parse_args()

    session = requests.Session()
    session.headers["User-Agent"] = "ecodata-lab-medellin-etl/1.0 (uso academico/investigacion)"
    # Sin App Token de Socrata: uso puntual y de bajo volumen (3 consultas
    # agregadas, no un scraper masivo). Si en el futuro esto se refresca con
    # frecuencia, registrar uno gratis en https://dev.socrata.com/docs/app-tokens
    # y pasarlo como header X-App-Token para evitar el throttling compartido
    # del namespace anónimo.

    print("Consultando total por comuna...")
    totales = fetch_total_por_comuna(session)
    print(f"  {len(totales)} comunas/corregimientos con al menos un diagnóstico J00-J99.")

    print("Consultando desglose por año...")
    por_anio = fetch_por_anio(session)

    print("Consultando top diagnósticos por comuna...")
    top_diagnosticos = fetch_top_diagnosticos(session)

    comunas_out = []
    for comuna, total in sorted(totales.items(), key=lambda kv: kv[1], reverse=True):
        comunas_out.append(
            {
                "comuna": comuna,
                "total_diagnosticos_respiratorios": total,
                "por_anio": por_anio.get(comuna, {}),
                "top_diagnosticos": top_diagnosticos.get(comuna, []),
            }
        )

    salida = {
        "fuente": {
            "nombre": "Perfil de morbilidad de la ESE Metrosalud",
            "url": "https://www.datos.gov.co/Salud-y-Protecci-n-Social/Perfil-de-morbilidad-de-la-ESE-Metrosalud/pypc-7h3w",
            "dataset_id": "pypc-7h3w",
            "fecha_consulta": time.strftime("%Y-%m-%d"),
            "rango_datos_fuente": "2024-01-01 a 2026-04-21 (según exploración previa; puede haber crecido desde entonces)",
            "filtro_aplicado": "codigo_diagnostico_principal LIKE 'J%' (CIE-10 J00-J99, enfermedades del sistema respiratorio)",
        },
        "metodologia": METODOLOGIA,
        "comunas": comunas_out,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(salida, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nGuardado: {args.out} ({len(comunas_out)} comunas/corregimientos)")


if __name__ == "__main__":
    main()
