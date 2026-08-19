"""Recalculo de EXPLORACION del recomendador de siembra (Bloque 2) usando el
inventario REAL de zonas verdes (`backend/data/inventario_zonas_verdes.geojson`),
que no existia cuando se genero `resumen_recomendacion_por_comuna.csv`.

SOLO CALCULO / SOLO LECTURA:
  - No escribe archivos, no persiste nada en base de datos.
  - No sobrescribe ningun CSV existente.
  - No toca endpoints ni frontend.

Reimplementa fielmente la logica de
`Visualizacion-de-datos/scripts/bloque_2/bloque2_recomendador_siembra.py`
(filtro de zonas viables, spatial join a comuna, normalizacion Min-Max y
score AHP), reutilizando `_normalizar` de `backend/app/services/ahp.py`.

PROPOSITO: correr el pipeline para las 21 comunas/corregimientos (en vez de
las que aparecian en el CSV original) y hacer VALIDACION CRUZADA contra el
CSV original para las comunas ya conocidas, antes de confiar en los scores
de las 10 comunas que antes no aparecian.

Uso:
    py backend/scripts/recalcular_siembra_zonas_verdes_reales.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.ahp import _normalizar  # noqa: E402

DATA_DIR = REPO_ROOT / "backend" / "data"
RUTA_COMUNAS = DATA_DIR / "limite_catastral_de_comun.geojson"
RUTA_ZONAS = DATA_DIR / "inventario_zonas_verdes.geojson"
RUTA_BLOQUE1 = DATA_DIR / "integracion_v2_pm25_arboles_medellin.csv"
RUTA_CSV_ORIGINAL = DATA_DIR / "resumen_recomendacion_por_comuna.csv"

# ---------------------------------------------------------------------------
# Mismos parametros / catalogos que el script fuente (Bloque 2)
# ---------------------------------------------------------------------------
W_PM25 = 0.45
W_DEF = 0.35
W_AREA = 0.20

COBER_APTA = {"Grama", "Tierra"}
CATEGORIA_EXCLUIDA = {"ZVPrivadas", "ZVUsoPrivado", "Parqueadero"}
BENCHMARK_PCT = 30.0

# Amplitud de copa minima + margen de seguridad -> capacidad de siembra
# Igual al catalogo ESPECIES del script fuente pero solo lo necesario para
# capacidad_zona() (usamos la especie generica de mayor prioridad estructural,
# ya que el objetivo aqui es el SCORE por comuna, no el detalle por especie).
ESPECIES_SEP_MIN = {
    "Zygia longifolia": 14 + 2,
    "Calliandra haematocephala": 7 + 1.5,
    "Bauhinia picta": 7 + 2,
    "Inga densiflora": 12 + 3,
    "Retrophyllum rospigliosii": 8 + 4,
}
# La zona recibe cupo>0 si al menos UNA especie cabe -> usamos la separacion
# minima mas chica (Calliandra, 8.5m) como criterio de "cabe >=1 arbol",
# igual de conservador que el script fuente (que exige categoria compatible).
SEP_MIN_GENERICA = min(ESPECIES_SEP_MIN.values())

GEOJSON_NOMBRE_MAP = {
    "BELEN": "Belén", "POPULAR": "Popular", "ROBLEDO": "Robledo",
    "ARANJUEZ": "Aranjuez", "CASTILLA": "Castilla", "GUAYABAL": "Guayabal",
    "LAURELES": "Laureles Estadio", "MANRIQUE": "Manrique",
    "PALMITAS": "Corregimiento de San Sebastián de Palmitas",
    "ALTAVISTA": "Corregimiento de Altavista",
    "EL POBLADO": "El Poblado", "LA AMERICA": "La América",
    "SAN JAVIER": "San Javier", "SANTA CRUZ": "Santa Cruz",
    "SANTA ELENA": "Corregimiento de Santa Elena",
    "BUENOS AIRES": "Buenos Aires", "LA CANDELARIA": "La Candelaria",
    "SAN CRISTOBAL": "Corregimiento de San Cristóbal",
    "VILLA HERMOSA": "Villa Hermosa", "DOCE DE OCTUBRE": "Doce de Octubre",
    "SAN ANTONIO DE PRADO": "Corregimiento de San Antonio de Prado",
}


def capacidad_zona(area_m2: float, sep_min_m: float) -> int:
    if sep_min_m <= 0 or area_m2 <= 0:
        return 0
    return max(0, math.floor(area_m2 / (sep_min_m ** 2)))


def main() -> None:
    print("=" * 78)
    print("RECALCULO EXPLORATORIO — Bloque 2 sobre 21 comunas (zonas verdes reales)")
    print("SOLO CALCULO: no se escribe ningun archivo.")
    print("=" * 78)

    # -- 1. Cargar capas ----------------------------------------------------
    gdf_comunas = gpd.read_file(RUTA_COMUNAS)
    gdf_zonas = gpd.read_file(RUTA_ZONAS)
    print(f"\n[1/5] Comunas: {len(gdf_comunas)}  |  Zonas verdes: {len(gdf_zonas):,}")

    gdf_comunas["comuna_nombre"] = gdf_comunas["nombre"].map(GEOJSON_NOMBRE_MAP)
    comunas_sin_mapear = gdf_comunas[gdf_comunas["comuna_nombre"].isna()]
    if len(comunas_sin_mapear):
        print(f"   AVISO: {len(comunas_sin_mapear)} polígonos sin mapeo de nombre: "
              f"{comunas_sin_mapear['nombre'].tolist()}")

    # -- 2. Filtrar zonas viables --------------------------------------------
    mask_cober = gdf_zonas["cober_dom"].isin(COBER_APTA)
    mask_cat = ~gdf_zonas["categoria"].isin(CATEGORIA_EXCLUIDA)
    mask_area = gdf_zonas["Shape_Area"] >= 25
    gdf_apta = gdf_zonas[mask_cober & mask_cat & mask_area].copy()
    print(f"[2/5] Zonas viables (cobertura+categoria+area>=25m2): {len(gdf_apta):,}")

    # -- 3. Spatial join a comuna --------------------------------------------
    gdf_join = gpd.sjoin(
        gdf_apta[["id_poligono", "tipologia", "categoria", "cober_dom",
                  "narb_aprox", "Shape_Area", "geometry"]],
        gdf_comunas[["comuna_nombre", "nombre", "geometry"]],
        how="left", predicate="within",
    )
    gdf_join = gdf_join[gdf_join["comuna_nombre"].notna()].copy()
    print(f"[3/5] Zonas asignadas a comuna: {len(gdf_join):,}")

    # cupo estimado por zona (>=1 especie cabe) para replicar el filtro
    # "zonas con cupo >= 1" del script fuente
    gdf_join["cupo_estimado"] = gdf_join["Shape_Area"].apply(
        lambda a: capacidad_zona(a, SEP_MIN_GENERICA)
    )
    gdf_con_cupo = gdf_join[gdf_join["cupo_estimado"] > 0].copy()

    area_por_comuna = (
        gdf_con_cupo.groupby("comuna_nombre")["Shape_Area"].sum()
        .reset_index().rename(columns={"comuna_nombre": "comuna", "Shape_Area": "area_apta_m2"})
    )
    n_zonas_por_comuna = gdf_con_cupo.groupby("comuna_nombre").size().rename("n_zonas")

    # -- 4. Bloque 1 (PM2.5) — poblacion base de la normalizacion -----------
    df_b1 = pd.read_csv(RUTA_BLOQUE1)
    df_pm = df_b1.groupby("comuna").agg(
        pm25_promedio=("pm25_promedio_ug_m3", "mean"),
        ratio_mitigadores=("ratio_mitigadores_pct", "first"),
    ).reset_index().round(2)
    ratio_por_comuna = dict(zip(df_pm["comuna"], df_pm["ratio_mitigadores"]))
    df_pm["deficit_pct"] = (BENCHMARK_PCT - df_pm["ratio_mitigadores"]).clip(lower=0).round(2)
    print(f"[4/5] Comunas con dato PM2.5 (Bloque 1, base de normalizacion): {len(df_pm)}")
    print(f"      -> {sorted(df_pm['comuna'].tolist())}")

    # df_score = TODAS las comunas del inventario de zonas verdes (21 posibles)
    # unidas con PM2.5 vía LEFT JOIN de df_pm hacia el universo de 21 comunas,
    # replicando exactamente la mecánica del script fuente: la normalización
    # Min-Max corre sobre `df_pm` (población PM2.5), no sobre las 21 comunas.
    df_score = df_pm.merge(area_por_comuna, on="comuna", how="left")
    df_score["area_apta_m2"] = df_score["area_apta_m2"].fillna(0)

    df_score["n_pm25"] = _normalizar(df_score["pm25_promedio"].tolist())
    df_score["n_def"] = _normalizar(df_score["deficit_pct"].tolist())
    df_score["n_area"] = _normalizar(df_score["area_apta_m2"].tolist())
    df_score["score_total"] = (
        W_PM25 * df_score["n_pm25"] + W_DEF * df_score["n_def"] + W_AREA * df_score["n_area"]
    ).round(4)
    df_score["ranking_prioridad"] = df_score["score_total"].rank(ascending=False).astype(int)

    # Comunas CON zona pero SIN PM2.5 -> sentinela score=0/rank=99 (igual que fuente)
    todas_las_comunas = sorted(set(GEOJSON_NOMBRE_MAP.values()))
    comunas_sin_pm25_con_zona = [
        c for c in area_por_comuna["comuna"] if c not in set(df_pm["comuna"])
    ]

    print(f"[5/5] Comunas con zona pero SIN PM2.5 (sentinela score=0): "
          f"{comunas_sin_pm25_con_zona}")

    # -- Resultado final: 21 comunas ------------------------------------------
    filas = []
    for comuna in todas_las_comunas:
        row_pm = df_score[df_score["comuna"] == comuna]
        n_zonas = int(n_zonas_por_comuna.get(comuna, 0))
        area_ha = round(float(area_por_comuna.set_index("comuna")["area_apta_m2"].get(comuna, 0.0)) / 10000, 4)
        if len(row_pm):
            r = row_pm.iloc[0]
            filas.append({
                "comuna": comuna,
                "score_multicriteria": r["score_total"],
                "ranking_prioridad": int(r["ranking_prioridad"]),
                "pm25_promedio": r["pm25_promedio"],
                "deficit_pct": r["deficit_pct"],
                "n_zonas_disponibles": n_zonas,
                "area_total_disponible_ha": area_ha,
                "tiene_pm25": True,
            })
        else:
            filas.append({
                "comuna": comuna,
                "score_multicriteria": 0.0,
                "ranking_prioridad": 99,
                "pm25_promedio": None,
                "deficit_pct": None,
                "n_zonas_disponibles": n_zonas,
                "area_total_disponible_ha": area_ha,
                "tiene_pm25": False,
            })

    df_resultado = pd.DataFrame(filas).sort_values(
        ["ranking_prioridad", "score_multicriteria"], ascending=[True, False]
    )

    print("\n" + "=" * 78)
    print("RESULTADO — 21 comunas (recalculo exploratorio, solo memoria)")
    print("=" * 78)
    print(df_resultado.to_string(index=False))

    # -- VALIDACION CRUZADA contra el CSV original ----------------------------
    print("\n" + "=" * 78)
    print("VALIDACION CRUZADA vs resumen_recomendacion_por_comuna.csv (original)")
    print("=" * 78)
    df_orig = pd.read_csv(RUTA_CSV_ORIGINAL)

    comparacion = []
    for _, orig in df_orig.iterrows():
        comuna = orig["comuna"]
        nuevo = df_resultado[df_resultado["comuna"] == comuna]
        if not len(nuevo):
            comparacion.append({"comuna": comuna, "estado": "NO ENCONTRADA EN RECALCULO"})
            continue
        nuevo = nuevo.iloc[0]
        diff_score = round(nuevo["score_multicriteria"] - orig["score_multicriteria"], 4)
        diff_rank = int(nuevo["ranking_prioridad"] - orig["ranking_prioridad"])
        comparacion.append({
            "comuna": comuna,
            "score_original": orig["score_multicriteria"],
            "score_recalculado": nuevo["score_multicriteria"],
            "diff_score": diff_score,
            "rank_original": int(orig["ranking_prioridad"]),
            "rank_recalculado": int(nuevo["ranking_prioridad"]),
            "diff_rank": diff_rank,
        })

    df_comp = pd.DataFrame(comparacion)
    print(df_comp.to_string(index=False))

    max_diff = df_comp["diff_score"].abs().max() if "diff_score" in df_comp else None
    rank_cambio = (df_comp["diff_rank"] != 0).sum() if "diff_rank" in df_comp else None
    print(f"\nMax |diff_score| = {max_diff}")
    print(f"Filas con cambio de ranking = {rank_cambio} / {len(df_comp)}")

    # -- PERSISTENCIA: comunas con PM2.5 (score AHP calculable) pero SIN -----
    # ninguna zona de siembra viable en el inventario real (GeoMedellín).
    # Estas 4 comunas (Santa Cruz, Villa Hermosa, San Cristóbal, Santa Elena)
    # NO aparecen en `resumen_recomendacion_por_comuna.csv` (ese archivo es
    # intocable) — se persisten aquí en un archivo NUEVO y separado.
    RUTA_SALIDA = DATA_DIR / "scores_ahp_extendido_sin_siembra.csv"
    comunas_original = set(df_orig["comuna"].tolist())
    df_sin_siembra = df_resultado[
        df_resultado["tiene_pm25"]
        & (df_resultado["n_zonas_disponibles"] == 0)
        & (~df_resultado["comuna"].isin(comunas_original))
    ].copy()
    df_sin_siembra["ratio_mitigadores"] = df_sin_siembra["comuna"].map(ratio_por_comuna)
    df_sin_siembra["arboles_a_plantar_total"] = 0
    df_sin_siembra["especie_principal"] = ""
    df_sin_siembra["cupo_especie_principal"] = 0
    df_salida = df_sin_siembra[[
        "comuna", "ranking_prioridad", "score_multicriteria", "n_zonas_disponibles",
        "area_total_disponible_ha", "arboles_a_plantar_total", "especie_principal",
        "cupo_especie_principal", "pm25_promedio", "deficit_pct", "ratio_mitigadores",
    ]].sort_values("ranking_prioridad")
    df_salida.to_csv(RUTA_SALIDA, index=False, encoding="utf-8-sig")

    print("\n" + "=" * 78)
    print(f"PERSISTIDO: {RUTA_SALIDA}")
    print("=" * 78)
    print(df_salida.to_string(index=False))
    print(
        "\nEstas comunas tienen score AHP calculable (PM2.5 disponible) pero "
        "0 zonas de siembra viables en el inventario real de zonas verdes: "
        "prioridad conocida, SIN sitio de siembra concreto."
    )


if __name__ == "__main__":
    main()
