"""Calcula el score AHP de Altavista usando el PM2.5 HISTORICO (no vigente)
de la estacion MED-ALTA2 (Corantioquia / SISAIRE-IDEAM) y el inventario REAL
de zonas verdes, reutilizando la misma logica de
`backend/scripts/recalcular_siembra_zonas_verdes_reales.py` (Bloque 2: Min-Max
+ combinacion ponderada) y del Bloque 1 (ratio de arboles mitigadores PM2.5,
cruzando SAU con el catalogo de especies mitigadoras ARBOLES.xlsx).

Persiste `backend/data/scores_ahp_altavista_historico.csv` con
`fuente_score="historico_no_vigente"` / `pm25_tipo_dato="historico"`.

SOLO Altavista. No toca ningun CSV existente (resumen_recomendacion_por_comuna,
scores_ahp_extendido_sin_siembra, scores_ahp_interpolado_idw).

Uso:
    py backend/scripts/calcular_score_ahp_altavista_historico.py
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
RUTA_SAU = DATA_DIR / "sau_arboles_urbanos.csv"
RUTA_PM25_ALTAVISTA = DATA_DIR / "pm25_historico_altavista.csv"
RUTA_ESPECIES_MITIGADORAS = (
    REPO_ROOT / "Visualizacion-de-datos" / "base_datos_arboles" / "ARBOLES" / "Data_Clean" / "ARBOLES.xlsx"
)
RUTA_SALIDA = DATA_DIR / "scores_ahp_altavista_historico.csv"

COMUNA_ALTAVISTA = "Corregimiento de Altavista"

W_PM25 = 0.45
W_DEF = 0.35
W_AREA = 0.20
BENCHMARK_PCT = 30.0

COBER_APTA = {"Grama", "Tierra"}
CATEGORIA_EXCLUIDA = {"ZVPrivadas", "ZVUsoPrivado", "Parqueadero"}

ESPECIES_SEP_MIN = {
    "Zygia longifolia": 14 + 2,
    "Calliandra haematocephala": 7 + 1.5,
    "Bauhinia picta": 7 + 2,
    "Inga densiflora": 12 + 3,
    "Retrophyllum rospigliosii": 8 + 4,
}
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
    print("SCORE AHP — Altavista (PM2.5 HISTORICO, estacion MED-ALTA2, no vigente)")
    print("=" * 78)

    # -- 1. PM2.5 historico de Altavista -------------------------------------
    df_pm25_alta = pd.read_csv(RUTA_PM25_ALTAVISTA, encoding="utf-8-sig")
    pm25_altavista = float(df_pm25_alta.iloc[0]["pm25_promedio_ultimo_anio"])
    fecha_ultimo_dato = str(df_pm25_alta.iloc[0]["fecha_ultimo_dato_real"])
    print(f"\n[1/6] PM2.5 historico Altavista = {pm25_altavista:.4f} ug/m3 "
          f"(ultimo dato real: {fecha_ultimo_dato})")

    # -- 2. Ratio de arboles mitigadores PM2.5 para Altavista (Bloque 1) ----
    df_mit_ref = pd.read_excel(RUTA_ESPECIES_MITIGADORAS, sheet_name="ESPECIE_REDUCEN ")
    col_especie = [c for c in df_mit_ref.columns if "ESPECIE" in c.upper()][0]
    especies_mitigadoras = set(df_mit_ref[col_especie].dropna().astype(str).str.strip().unique())
    print(f"[2/6] Especies mitigadoras PM2.5 en catalogo: {len(especies_mitigadoras)}")

    df_sau = pd.read_csv(RUTA_SAU, encoding="utf-8-sig")
    df_sau_alta = df_sau[df_sau["comuna"] == COMUNA_ALTAVISTA].copy()
    total_arboles = len(df_sau_alta)
    df_sau_alta["es_mitigador"] = df_sau_alta["s_especie"].astype(str).str.strip().isin(especies_mitigadoras)
    n_mitigadores = int(df_sau_alta["es_mitigador"].sum())
    ratio_mitigadores_altavista = round(100 * n_mitigadores / total_arboles, 2) if total_arboles else 0.0
    deficit_pct_altavista = round(max(0.0, BENCHMARK_PCT - ratio_mitigadores_altavista), 2)
    print(f"      Arboles SAU en Altavista: {total_arboles:,}  |  Mitigadores PM2.5: {n_mitigadores:,}"
          f"  |  ratio_mitigadores={ratio_mitigadores_altavista}%  |  deficit_pct={deficit_pct_altavista}")

    # -- 3. Poblacion PM2.5 de referencia (Bloque 1, 11 comunas originales) --
    # Se agrega Altavista a esta poblacion (con su PM2.5 HISTORICO) para que
    # la normalizacion Min-Max sea comparable con el resto del sistema —
    # misma mecanica que `recalcular_siembra_zonas_verdes_reales.py`.
    df_b1 = pd.read_csv(RUTA_BLOQUE1)
    df_pm = df_b1.groupby("comuna").agg(
        pm25_promedio=("pm25_promedio_ug_m3", "mean"),
        ratio_mitigadores=("ratio_mitigadores_pct", "first"),
    ).reset_index().round(2)
    df_pm["deficit_pct"] = (BENCHMARK_PCT - df_pm["ratio_mitigadores"]).clip(lower=0).round(2)

    fila_altavista = pd.DataFrame([{
        "comuna": COMUNA_ALTAVISTA,
        "pm25_promedio": round(pm25_altavista, 4),
        "ratio_mitigadores": ratio_mitigadores_altavista,
        "deficit_pct": deficit_pct_altavista,
    }])
    df_pm_ext = pd.concat([df_pm, fila_altavista], ignore_index=True)
    print(f"[3/6] Poblacion de normalizacion PM2.5: {len(df_pm_ext)} comunas "
          f"(11 originales + Altavista)")

    # -- 4. Area apta de siembra real para Altavista (Bloque 2) -------------
    gdf_comunas = gpd.read_file(RUTA_COMUNAS)
    gdf_zonas = gpd.read_file(RUTA_ZONAS)
    gdf_comunas["comuna_nombre"] = gdf_comunas["nombre"].map(GEOJSON_NOMBRE_MAP)

    mask_cober = gdf_zonas["cober_dom"].isin(COBER_APTA)
    mask_cat = ~gdf_zonas["categoria"].isin(CATEGORIA_EXCLUIDA)
    mask_area = gdf_zonas["Shape_Area"] >= 25
    gdf_apta = gdf_zonas[mask_cober & mask_cat & mask_area].copy()

    gdf_join = gpd.sjoin(
        gdf_apta[["id_poligono", "tipologia", "categoria", "cober_dom",
                  "narb_aprox", "Shape_Area", "geometry"]],
        gdf_comunas[["comuna_nombre", "nombre", "geometry"]],
        how="left", predicate="within",
    )
    gdf_join = gdf_join[gdf_join["comuna_nombre"].notna()].copy()
    gdf_join["cupo_estimado"] = gdf_join["Shape_Area"].apply(lambda a: capacidad_zona(a, SEP_MIN_GENERICA))
    gdf_con_cupo = gdf_join[gdf_join["cupo_estimado"] > 0].copy()

    gdf_alta = gdf_con_cupo[gdf_con_cupo["comuna_nombre"] == COMUNA_ALTAVISTA]
    area_apta_m2_altavista = float(gdf_alta["Shape_Area"].sum())
    n_zonas_altavista = int(len(gdf_alta))
    area_ha_altavista = round(area_apta_m2_altavista / 10000, 4)
    print(f"[4/6] Zonas verdes viables en Altavista: {n_zonas_altavista}  |  "
          f"Area apta: {area_ha_altavista} ha")

    # -- 5. Normalizacion Min-Max + score AHP (mismos pesos que Bloque 2) ---
    area_por_comuna = {COMUNA_ALTAVISTA: area_apta_m2_altavista}
    df_pm_ext["area_apta_m2"] = df_pm_ext["comuna"].map(area_por_comuna).fillna(0.0)

    df_pm_ext["n_pm25"] = _normalizar(df_pm_ext["pm25_promedio"].tolist())
    df_pm_ext["n_def"] = _normalizar(df_pm_ext["deficit_pct"].tolist())
    df_pm_ext["n_area"] = _normalizar(df_pm_ext["area_apta_m2"].tolist())
    df_pm_ext["score_total"] = (
        W_PM25 * df_pm_ext["n_pm25"] + W_DEF * df_pm_ext["n_def"] + W_AREA * df_pm_ext["n_area"]
    ).round(4)
    df_pm_ext["ranking_prioridad"] = df_pm_ext["score_total"].rank(ascending=False).astype(int)

    fila_final = df_pm_ext[df_pm_ext["comuna"] == COMUNA_ALTAVISTA].iloc[0]
    print(f"[5/6] Score AHP Altavista = {fila_final['score_total']}  |  "
          f"ranking (entre 12 comunas con PM2.5) = {int(fila_final['ranking_prioridad'])}")

    # -- 6. Persistir ---------------------------------------------------------
    df_salida = pd.DataFrame([{
        "comuna": COMUNA_ALTAVISTA,
        "ranking_prioridad": int(fila_final["ranking_prioridad"]),
        "score_multicriteria": float(fila_final["score_total"]),
        "n_zonas_disponibles": n_zonas_altavista,
        "area_total_disponible_ha": area_ha_altavista,
        "arboles_a_plantar_total": 0,
        "especie_principal": "",
        "cupo_especie_principal": 0,
        "pm25_promedio": round(pm25_altavista, 4),
        "deficit_pct": deficit_pct_altavista,
        "ratio_mitigadores": ratio_mitigadores_altavista,
        "pm25_fecha_ultimo_dato": fecha_ultimo_dato,
    }])
    df_salida.to_csv(RUTA_SALIDA, index=False, encoding="utf-8-sig")
    print(f"\n[6/6] PERSISTIDO: {RUTA_SALIDA}")
    print(df_salida.to_string(index=False))


if __name__ == "__main__":
    main()
