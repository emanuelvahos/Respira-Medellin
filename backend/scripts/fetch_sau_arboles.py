"""Descarga el inventario completo de árboles del SAU (Alcaldía de Medellín).

Fuente: servicio ArcGIS REST público y sin autenticación
`VA_SistemaArbolUrbano_Ciudadano/MapServer/1` ("Arbol Urbano"), confirmado por
inspección de la pestaña Network del visor https://www.medellin.gov.co/sau/.
`?f=json` en la raíz del servicio no declara ningún término de uso/licencia
explícito (el campo `copyrightText` viene vacío); es infraestructura pública
de la Alcaldía sin restricción documentada, pero se descarga con throttling
para no sobrecargarla — no es una API comercial con SLA de rate limit.

Paginación: `resultOffset`/`resultRecordCount=2000` (tope real del servicio,
`maxRecordCount: 2000`). Se pide `orderByFields=objectid` para que el orden de
páginas sea determinista (evita duplicados/huecos si el dataset cambia entre
requests). Deduplicación adicional por `objectid` como red de seguridad.

Uso:
    python backend/scripts/fetch_sau_arboles.py
    python backend/scripts/fetch_sau_arboles.py --out backend/data/sau_arboles_urbanos.csv --sleep 1.0
"""

from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path

import requests

SERVICE_URL = (
    "https://www.medellin.gov.co/servidormapas/rest/services/"
    "ambiente_dllo_sost/VA_SistemaArbolUrbano_Ciudadano/MapServer/1/query"
)
PAGE_SIZE = 2000
DEFAULT_SLEEP_SECONDS = 1.0
MAX_RETRIES = 4
RETRY_BACKOFF_SECONDS = 3.0

# Columnas que se conservan del servicio (ver exploración: 26 campos totales,
# se descartan los puramente internos de ArcGIS/contrato que no aportan al
# dashboard/mapa: sid, id_estado, id_contrato, contrato, s_estado_int_contrato,
# s_observaciones, s_intervencion, numero_intervenciones, d_fecha,
# cod_individuo_disperso_amva, point_x, point_y (point_x/y son la proyección
# nativa EPSG:3116; se guardan lon/lat WGS84 directamente desde la geometría).
FIELDS_OUT = [
    "objectid",
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
    "lon",
    "lat",
]


def fetch_count(session: requests.Session) -> int:
    resp = session.get(
        SERVICE_URL,
        params={"where": "1=1", "returnCountOnly": "true", "f": "json"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["count"]


def fetch_page(session: requests.Session, offset: int) -> dict:
    last_exc: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            resp = session.get(
                SERVICE_URL,
                params={
                    "where": "1=1",
                    "outFields": ",".join(f for f in FIELDS_OUT if f not in ("lon", "lat")),
                    "orderByFields": "objectid",
                    "resultOffset": offset,
                    "resultRecordCount": PAGE_SIZE,
                    "f": "geojson",
                },
                timeout=60,
            )
            resp.raise_for_status()
            return resp.json()
        except (requests.RequestException, ValueError) as exc:
            last_exc = exc
            wait = RETRY_BACKOFF_SECONDS * attempt
            print(
                f"  [offset={offset}] intento {attempt}/{MAX_RETRIES} falló ({exc}); "
                f"reintentando en {wait:.0f}s...",
                file=sys.stderr,
            )
            time.sleep(wait)
    raise RuntimeError(f"No se pudo descargar offset={offset} tras {MAX_RETRIES} intentos") from last_exc


def feature_to_row(feature: dict) -> dict | None:
    geom = feature.get("geometry")
    coords = (geom or {}).get("coordinates")
    # geometryType es esriGeometryMultipoint -> GeoJSON MultiPoint:
    # coordinates = [[lon, lat], ...] (normalmente un único punto por árbol).
    if not coords:
        return None
    lon, lat = coords[0][0], coords[0][1]
    props = feature["properties"]
    row = {k: props.get(k) for k in FIELDS_OUT if k not in ("lon", "lat")}
    row["lon"] = lon
    row["lat"] = lat
    return row


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "sau_arboles_urbanos.csv",
    )
    parser.add_argument("--sleep", type=float, default=DEFAULT_SLEEP_SECONDS)
    args = parser.parse_args()

    session = requests.Session()
    session.headers["User-Agent"] = "ecodata-lab-medellin-etl/1.0 (uso academico/investigacion)"

    print("Consultando conteo total del servicio...")
    expected_total = fetch_count(session)
    print(f"Total reportado por el servicio: {expected_total}")

    seen_objectids: set[int] = set()
    rows: list[dict] = []
    offset = 0
    page_num = 0

    while True:
        page_num += 1
        print(f"Página {page_num}: offset={offset}...", end=" ", flush=True)
        data = fetch_page(session, offset)
        features = data.get("features", [])
        if not features:
            print("sin features, fin de paginación.")
            break

        added = 0
        for feature in features:
            row = feature_to_row(feature)
            if row is None:
                continue
            oid = row["objectid"]
            if oid in seen_objectids:
                continue
            seen_objectids.add(oid)
            rows.append(row)
            added += 1
        print(f"{len(features)} recibidos, {added} nuevos (acumulado: {len(rows)}).")

        if len(features) < PAGE_SIZE:
            # Última página (el servicio devolvió menos del tope por página).
            break
        offset += PAGE_SIZE
        time.sleep(args.sleep)  # throttling obligatorio: servicio público compartido.

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS_OUT)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nGuardado: {args.out} ({len(rows)} filas)")
    print(f"Esperado (returnCountOnly): {expected_total}")
    if len(rows) != expected_total:
        diff = expected_total - len(rows)
        print(
            f"ADVERTENCIA: diferencia de {diff} registros entre lo descargado y "
            "el conteo reportado por el servicio (posible cambio de datos "
            "durante la descarga, o features sin geometría descartadas)."
        )
    else:
        print("Conteo coincide exactamente con el esperado.")


if __name__ == "__main__":
    main()
