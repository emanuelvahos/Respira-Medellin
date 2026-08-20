"""Auditoría de viabilidad de `zonas_priorizadas_siembra.geojson` (Fase D).

CONTEXTO: el pipeline original (`bloque2_recomendador_siembra.py`) ya filtra
zonas por `cober_dom` (Grama/Tierra) y excluye `categoria` privada
(ZVPrivadas, ZVUsoPrivado). Pero `categoria` en GeoMedellín es una
clasificación gruesa (17 valores: Antejardin, Separador, ParqueRec,
ZVRecreacional, ParqueCiv, OrejaPuente, ...) que NO distingue una cancha o
plazoleta con césped perimetral de una zona verde real — esa señal vive en
otros dos campos del inventario que el pipeline original nunca consultó:

  - `subcategoria`: "Plaza", "Plazoleta", "Plazuela", "Parqueaderos a nivel"
    son superficie dura por definición, sin importar qué diga `cober_dom`
    para ese polígono.
  - `infraestructura` / `equipamiento`: nombre del predio/instalación que
    contiene el polígono (p. ej. "Unidad Deportiva Atanasio Girardot",
    "Placa Polideportiva Moravia", "Cancha de Fútbol Moravia"). Un polígono
    con `cober_dom=Grama` DENTRO de una unidad deportiva es plausiblemente el
    borde/separador de una cancha, no césped sembrable sin restricciones.

MÉTODO: overlay espacial real (geopandas/shapely) de cada zona de
`zonas_priorizadas_siembra.geojson` contra `inventario_zonas_verdes.geojson`
completo — no un simple join por `id_poligono`, aunque en la práctica (ver
salida del script) las geometrías de origen coinciden 1:1 porque el pipeline
original ya usaba este mismo inventario como fuente. El overlay espacial es
el método correcto de todos modos: no asume que los IDs seguirán siendo
estables si el inventario se refresca (ver docs/ACTUALIZACION_DATOS.md) — un
polígono de siembra podría en el futuro solaparse con varios polígonos del
inventario nuevo, o con ninguno.

CLASIFICACIÓN (deliberadamente conservadora — ver `_clasificar`):
  - "posible_no_viable": el polígono dominante por área de intersección
    tiene subcategoria de superficie dura, O su infraestructura/equipamiento
    coincide con una lista cerrada de palabras clave deportivas/recreativas
    duras (cancha, estadio, coliseo, polideportivo, placa polideportiva,
    unidad deportiva). Lista cerrada a propósito: nombres de universidades,
    hospitales, cementerios o el aeropuerto NO se marcan aunque aparezcan en
    `infraestructura`, porque esos predios sí suelen tener zonas verdes
    reales sembrables (jardines, prados) — marcarlos todos como no viables
    sería un falso positivo masivo, no una auditoría útil. Ver
    `PALABRAS_CLAVE_NO_SEMBRABLE` para la lista exacta y ajustarla con
    criterio de la Secretaría si hace falta.
  - "sin_solape_con_inventario_real": el polígono de siembra no intersecta
    ningún polígono del inventario actual (geometría desactualizada frente
    al inventario vigente). Distinto de "no viable": no dice nada sobre si
    el sitio es sembrable, solo que no se pudo verificar contra el
    inventario actual.
  - "consistente": tiene solape real y ninguna señal de alerta. NO es una
    garantía de viabilidad — solo significa "sin bandera roja conocida en
    este cruce"; sigue habiendo ambigüedad residual no resuelta aquí (ver
    docstring de `_clasificar`).

USO:
    py backend/scripts/auditar_viabilidad_siembra.py

Escribe `backend/data/auditoria_viabilidad_siembra.geojson` — nunca toca
`zonas_priorizadas_siembra.geojson` ni `inventario_zonas_verdes.geojson`.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

import geopandas as gpd  # noqa: E402

from app.core.config import get_settings  # noqa: E402

# Palabras clave sobre `infraestructura`/`equipamiento` (minúsculas, sin
# tildes normalizadas a mano por los valores reales vistos en el dataset).
# Cerrada deliberadamente a instalaciones deportivas/recreativas duras: ver
# docstring del módulo para por qué universidades/hospitales/cementerios NO
# entran aquí aunque aparezcan como infraestructura.
PALABRAS_CLAVE_NO_SEMBRABLE = (
    "cancha",
    "estadio",
    "coliseo",
    "polideportivo",
    "placa polideportiva",
    "unidad deportiva",
    "parque deportivo",
)

# subcategoria de superficie dura: independiente de cober_dom (que el
# pipeline original ya filtra a Grama/Tierra) porque subcategoria describe
# el USO del suelo, no la cobertura vegetal reportada para ese polígono —
# pueden discrepar si el polígono tiene borde/franja de césped alrededor de
# una plaza dura.
SUBCATEGORIA_SUPERFICIE_DURA = frozenset(
    {"Plaza", "Plazoleta", "Plazuela", "Parqueaderos a nivel"}
)

UMBRAL_SOLAPE_DOMINANTE = 0.5  # fracción mínima del área del polígono de
# siembra que debe cubrir el polígono dominante del inventario para que su
# categoría se considere representativa (evita que un solape marginal de 1%
# en el borde decida la clasificación).


def _es_no_sembrable(subcategoria: str, infraestructura: str, equipamiento: str) -> str | None:
    """Devuelve el motivo textual si hay señal de no-sembrable, o None."""
    if subcategoria in SUBCATEGORIA_SUPERFICIE_DURA:
        return f"subcategoria de superficie dura ({subcategoria})"
    texto = f"{infraestructura} {equipamiento}".lower()
    if texto.strip() and texto.strip() != "no aplica no aplica":
        for palabra in PALABRAS_CLAVE_NO_SEMBRABLE:
            if palabra in texto:
                nombre = infraestructura if infraestructura.lower() != "no aplica" else equipamiento
                return f"infraestructura deportiva/recreativa ({nombre})"
    return None


def main() -> None:
    settings = get_settings()
    ruta_siembra = settings.data_zonas_priorizadas_siembra
    ruta_inventario = settings.data_inventario_zonas_verdes
    ruta_salida = REPO_ROOT / "backend" / "data" / "auditoria_viabilidad_siembra.geojson"

    print(f"Leyendo {ruta_siembra}...")
    siembra = gpd.read_file(ruta_siembra)
    print(f"Leyendo {ruta_inventario} (48k polígonos, puede tardar)...")
    inventario = gpd.read_file(ruta_inventario)

    if siembra.crs != inventario.crs:
        inventario = inventario.to_crs(siembra.crs)

    siembra = siembra.reset_index(drop=True)
    siembra["_zona_idx"] = siembra.index
    siembra["_area_zona"] = siembra.geometry.area

    inv_cols = ["id_poligono", "categoria", "subcategoria", "cober_dom",
                "infraestructura", "equipamiento", "geometry"]
    inventario_para_join = inventario[[c for c in inv_cols if c in inventario.columns]].copy()
    inventario_para_join = inventario_para_join.rename(columns={"id_poligono": "id_poligono_inv"})

    # Overlay real (intersección geométrica), no un join por atributo: cada
    # par (zona de siembra, polígono de inventario) que se solapa produce una
    # fila con la geometría de la intersección, de la que calculamos el área.
    interseccion = gpd.overlay(
        siembra[["_zona_idx", "id_poligono", "_area_zona", "geometry"]],
        inventario_para_join,
        how="intersection",
        keep_geom_type=False,
    )
    interseccion["_area_interseccion"] = interseccion.geometry.area

    resultados: dict[int, dict] = {}
    ids_con_solape: set[int] = set()

    for zona_idx, grupo in interseccion.groupby("_zona_idx"):
        ids_con_solape.add(zona_idx)
        fila_dominante = grupo.loc[grupo["_area_interseccion"].idxmax()]
        area_zona = fila_dominante["_area_zona"]
        fraccion_cubierta = fila_dominante["_area_interseccion"] / area_zona if area_zona > 0 else 0.0

        subcategoria = fila_dominante.get("subcategoria") or "No aplica"
        infraestructura = fila_dominante.get("infraestructura") or "No aplica"
        equipamiento = fila_dominante.get("equipamiento") or "No aplica"

        motivo = _es_no_sembrable(subcategoria, infraestructura, equipamiento)
        # Solo aplica el motivo si el polígono dominante realmente cubre una
        # fracción significativa del área de la zona de siembra (evita que un
        # solape marginal de borde con una cancha vecina decida el resultado).
        if motivo is not None and fraccion_cubierta >= UMBRAL_SOLAPE_DOMINANTE:
            resultados[zona_idx] = {
                "viabilidad_auditada": "posible_no_viable",
                "viabilidad_motivo": motivo,
                "viabilidad_id_poligono_inventario": int(fila_dominante["id_poligono_inv"]),
                "viabilidad_fraccion_cubierta": round(float(fraccion_cubierta), 3),
            }
        else:
            resultados[zona_idx] = {
                "viabilidad_auditada": "consistente",
                "viabilidad_motivo": None,
                "viabilidad_id_poligono_inventario": int(fila_dominante["id_poligono_inv"]),
                "viabilidad_fraccion_cubierta": round(float(fraccion_cubierta), 3),
            }

    for zona_idx in siembra["_zona_idx"]:
        if zona_idx not in ids_con_solape:
            resultados[zona_idx] = {
                "viabilidad_auditada": "sin_solape_con_inventario_real",
                "viabilidad_motivo": None,
                "viabilidad_id_poligono_inventario": None,
                "viabilidad_fraccion_cubierta": 0.0,
            }

    conteo = Counter(r["viabilidad_auditada"] for r in resultados.values())
    print("\n=== Resultado de la auditoría ===")
    print(f"Total zonas de siembra: {len(siembra)}")
    for categoria in ("consistente", "posible_no_viable", "sin_solape_con_inventario_real"):
        print(f"  {categoria}: {conteo.get(categoria, 0)}")

    # Sanity check documentado en el módulo: como el pipeline original ya usa
    # este mismo inventario como fuente, el polígono dominante por área
    # debería coincidir con id_poligono en (casi) todos los casos.
    coincide_id = sum(
        1
        for i, r in resultados.items()
        if r["viabilidad_id_poligono_inventario"] == int(siembra.loc[i, "id_poligono"])
    )
    print(
        f"\nSanity check: en {coincide_id}/{len(siembra)} zonas el polígono "
        "dominante por área de intersección coincide con el id_poligono "
        "original (esperado ~100% dado que el pipeline ya usa este "
        "inventario como fuente)."
    )

    motivos = Counter(
        r["viabilidad_motivo"] for r in resultados.values() if r["viabilidad_motivo"]
    )
    if motivos:
        print("\nMotivos de 'posible_no_viable' (agrupados):")
        for motivo, n in motivos.most_common():
            print(f"  {n:4d}  {motivo}")

    features_salida = []
    for zona_idx in siembra["_zona_idx"]:
        r = resultados[zona_idx]
        features_salida.append(
            {
                "type": "Feature",
                "properties": {
                    "id_poligono": int(siembra.loc[zona_idx, "id_poligono"]),
                    **r,
                },
                "geometry": None,
            }
        )

    salida = {"type": "FeatureCollection", "features": features_salida}
    ruta_salida.write_text(json.dumps(salida, ensure_ascii=False), encoding="utf-8")
    print(f"\nEscrito {ruta_salida} ({len(features_salida)} registros, sin geometría — "
          "es una tabla de auditoría por id_poligono, la geometría real sigue "
          "viviendo solo en zonas_priorizadas_siembra.geojson).")


if __name__ == "__main__":
    main()
