"""Análisis de diversificación de especies por zona de siembra (Fase E3).

CONTEXTO: el pipeline original asigna el 100% de la capacidad de cada zona
(`arboles_cupo_estimado`) a UNA sola especie "óptima" (`especie_para_zona()`
en `bloque2_recomendador_siembra.py`, que puntúa candidatas y se queda con
la de mayor puntaje). Este script NO cambia esa recomendación oficial —
calcula, con los mismos dos criterios reales que ya usa esa función
(rango altitudinal + `categoria` de la zona), el CONJUNTO COMPLETO de
especies compatibles por zona (no solo la ganadora), para medir cuánto
margen real hay para diversificar en vez de monocultivo.

CRITERIOS DE COMPATIBILIDAD (idénticos a `especie_para_zona()`, no
inventados):
  1. Rango altitudinal: la altitud de la zona debe caer dentro de
     `rango_altitudinal_msnm` de la especie. El pipeline original NO tiene
     altitud por zona individual — usa una única constante
     ALTITUD_MEDELLIN=1495 msnm para las 1.648 zonas por igual. Este
     script usa la misma constante por honestidad metodológica: no
     inventamos una altitud por zona que no existe en ninguna fuente real
     del proyecto (ver `_nota_altitud_fase_e3` en fichas_especies.json).
  2. `categoria` de la zona debe estar en `categorias_aptas` de la especie
     — este SÍ varía zona a zona (viene de `zonas_priorizadas_siembra.geojson`
     / `recomendacion_siembra_por_zona.csv`) y es, en la práctica, el
     verdadero diferenciador de compatibilidad entre zonas dado que el
     criterio de altitud es constante para todas.

Tipo de suelo (`tipo_suelo` en la ficha) NO se evalúa: no existe un campo
de tipo de suelo por zona comparable a ese dato de la especie (`cober_dom`
mide cobertura vegetal — Grama/Tierra —, una dimensión distinta de tipo de
suelo/drenaje). Evaluar "compatibilidad de suelo" sin un dato real
equivalente sería inventar una comparación — se documenta como "no
evaluable", tal como pide la restricción explícita del prompt.

MÉTODO DE DISTRIBUCIÓN (solo para zonas con 2+ especies compatibles Y
cupo >= UMBRAL_MIN_INDIVIDUOS): reparto EQUITATIVO simple entre las
especies compatibles. Se descartó ponderar por "cercanía del rango
altitudinal de la especie al punto medio de la zona" (alternativa sugerida
en el prompt) porque, al ser la altitud una constante única para las 1.648
zonas (ver arriba), ese peso sería IDÉNTICO para un mismo conjunto de
especies en cualquier zona — no aporta información real específica de la
zona, sería precisión falsa. El reparto equitativo es la alternativa
honesta cuando no hay una base real por-zona para ponderar de otra forma.

UMBRAL: zonas con `arboles_cupo_estimado` < 10 NO se procesan — dividir
menos de 10 individuos entre 2+ especies no tiene sentido práctico
(resultarían en grupos de 1-4 individuos por especie, ecológicamente
insignificante como diversificación real). Ver `UMBRAL_MIN_INDIVIDUOS`.

USO:
    py backend/scripts/analizar_diversificacion_especies.py

Escribe `backend/data/diversificacion_especies_siembra.geojson` (tabla sin
geometría, igual que `auditoria_viabilidad_siembra.geojson` — indexada por
`id_poligono`, se cruza en el backend). NUNCA toca
`zonas_priorizadas_siembra.geojson` ni `recomendacion_siembra_por_zona.csv`.
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.core.config import get_settings  # noqa: E402

ALTITUD_MEDELLIN_MSNM = 1495  # idéntica a ALTITUD_MEDELLIN en el pipeline original
UMBRAL_MIN_INDIVIDUOS = 10


def _cargar_fichas(path: Path) -> dict[str, dict]:
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)
    return raw["especies"]


def _especies_compatibles(categoria: str, fichas: dict[str, dict]) -> list[str]:
    compatibles = []
    for nombre, datos in fichas.items():
        alt_min, alt_max = datos["rango_altitudinal_msnm"]
        if not (alt_min <= ALTITUD_MEDELLIN_MSNM <= alt_max):
            continue
        if categoria in datos.get("categorias_aptas", []):
            compatibles.append(nombre)
    return compatibles


def _reparto_equitativo(cupo: int, especies: list[str]) -> list[dict]:
    """Reparto equitativo con método de mayor resto (largest remainder) para
    que la suma de individuos por especie sea exactamente igual a `cupo` —
    no se pierden ni se inventan individuos al redondear."""
    n = len(especies)
    base = cupo // n
    resto = cupo % n
    reparto = [{"especie": e, "individuos_estimado": base} for e in especies]
    # Los primeros `resto` (en orden alfabético, para que sea determinista y
    # reproducible entre corridas) reciben 1 individuo adicional.
    for item in sorted(reparto, key=lambda r: r["especie"])[:resto]:
        item["individuos_estimado"] += 1
    for item in reparto:
        item["proporcion"] = round(item["individuos_estimado"] / cupo, 3)
    return reparto


def main() -> None:
    settings = get_settings()
    ruta_zonas = settings.data_recomendacion_siembra_zona
    ruta_fichas = settings.data_fichas_especies
    ruta_salida = REPO_ROOT / "backend" / "data" / "diversificacion_especies_siembra.geojson"

    fichas = _cargar_fichas(ruta_fichas)
    print(f"Fichas cargadas: {len(fichas)} especies")

    with ruta_zonas.open(encoding="utf-8-sig") as f:
        zonas = list(csv.DictReader(f))
    print(f"Zonas de siembra: {len(zonas)}")

    conteo_compatibles = Counter()
    resultados: list[dict] = []
    zonas_diversificables = 0
    zonas_bajo_umbral_excluidas = 0

    for zona in zonas:
        categoria = zona["categoria"]
        cupo = int(zona["arboles_cupo_estimado"])
        compatibles = _especies_compatibles(categoria, fichas)
        conteo_compatibles[len(compatibles)] += 1

        diversificacion_disponible = len(compatibles) >= 2
        propuesta = None
        if diversificacion_disponible:
            if cupo < UMBRAL_MIN_INDIVIDUOS:
                zonas_bajo_umbral_excluidas += 1
                diversificacion_disponible = False
            else:
                propuesta = _reparto_equitativo(cupo, compatibles)
                zonas_diversificables += 1

        resultados.append(
            {
                "id_poligono": int(zona["id_poligono"]),
                "categoria": categoria,
                "arboles_cupo_estimado": cupo,
                "n_especies_compatibles": len(compatibles),
                "especies_compatibles": compatibles,
                "diversificacion_disponible": diversificacion_disponible,
                "propuesta_diversificacion": propuesta,
            }
        )

    print("\n=== Distribución de zonas por número de especies compatibles ===")
    print("(criterios: rango altitudinal a 1.495 msnm + categoria de la zona,")
    print(" idénticos a especie_para_zona() del pipeline original)")
    total = len(zonas)
    for n in sorted(conteo_compatibles):
        cnt = conteo_compatibles[n]
        print(f"  {n} especie(s) compatible(s): {cnt:5d} zonas ({100*cnt/total:5.1f}%)")

    zonas_1_especie = conteo_compatibles.get(1, 0) + conteo_compatibles.get(0, 0)
    zonas_2mas = total - zonas_1_especie
    print(f"\nZonas con 1 sola especie compatible (sin margen de diversificar): "
          f"{zonas_1_especie} ({100*zonas_1_especie/total:.1f}%)")
    print(f"Zonas con 2+ especies compatibles (candidatas a diversificar): "
          f"{zonas_2mas} ({100*zonas_2mas/total:.1f}%)")
    print(f"  De esas, excluidas por umbral (<{UMBRAL_MIN_INDIVIDUOS} individuos): "
          f"{zonas_bajo_umbral_excluidas}")
    print(f"  Diversificación generada (2+ especies Y cupo >= {UMBRAL_MIN_INDIVIDUOS}): "
          f"{zonas_diversificables} zonas ({100*zonas_diversificables/total:.1f}%)")

    salida = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": r, "geometry": None} for r in resultados
    ]}
    ruta_salida.write_text(json.dumps(salida, ensure_ascii=False), encoding="utf-8")
    print(f"\nEscrito {ruta_salida}")


if __name__ == "__main__":
    main()
