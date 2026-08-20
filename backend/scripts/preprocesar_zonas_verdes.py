"""Preprocesa el inventario CRUDO de zonas verdes (GeoMedellín, ~48.348
polígonos) y escribe el resultado ya reproyectado/simplificado a
`backend/data/zonas_verdes_procesado.geojson`.

POR QUÉ EXISTE ESTE SCRIPT: `/api/zonas-verdes` respondía 502 en Render.
Causa: el procesamiento (reproyección + simplify de 48k polígonos, ~55s en
frío) ocurría de forma perezosa dentro del primer request real que pedía la
capa (`@lru_cache` se llena recién cuando alguien lo pide), superando el
timeout de request de Render. La corrección es que ese cómputo nunca ocurra
en el camino de un request HTTP: se corre una sola vez, aquí, y
`/api/zonas-verdes` sirve el archivo ya listo (ver backend/README.md,
sección "Por qué /api/zonas-verdes sirve un archivo precomputado").

CUÁNDO CORRERLO: cada vez que se reemplaza
`backend/data/inventario_zonas_verdes.geojson` (ver
docs/ACTUALIZACION_DATOS.md, sección 2 "Zonas verdes") — el refresco manual
de esa fuente ahora incluye este paso, no solo descargar el archivo crudo.

Uso:
    py backend/scripts/preprocesar_zonas_verdes.py
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.core.config import get_settings  # noqa: E402
from app.services.data_loader import procesar_zonas_verdes_geojson  # noqa: E402


def main() -> None:
    settings = get_settings()
    raw_path = settings.data_inventario_zonas_verdes
    out_path = settings.data_inventario_zonas_verdes_procesado

    if not raw_path.exists():
        raise SystemExit(
            f"No se encontró el archivo crudo en '{raw_path}' "
            f"(DATA_INVENTARIO_ZONAS_VERDES en backend/.env)."
        )

    print(f"Leyendo y procesando {raw_path}...")
    inicio = time.monotonic()
    resultado = procesar_zonas_verdes_geojson(raw_path)
    duracion = time.monotonic() - inicio

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(resultado), encoding="utf-8")

    print(
        f"{len(resultado['features'])} features procesadas en {duracion:.1f}s. "
        f"Escrito en {out_path}."
    )


if __name__ == "__main__":
    main()
