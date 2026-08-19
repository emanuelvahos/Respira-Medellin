"""Interpolación IDW (Inverse Distance Weighting) de PM2.5 para las 3 comunas
que NO tienen ninguna estación SIATA dentro de su polígono pero SÍ están en
zona urbana continua a distancia razonable de estaciones reales: Popular,
Manrique, Doce de Octubre.

CONTEXTO YA VALIDADO (ver docs/ESTADO_PROYECTO.md y backend/README.md):
  - Se confirmó con point-in-polygon real (limite_catastral_de_comun.geojson,
    EPSG:9377) que NINGUNA estación SIATA cae dentro de estas 3 comunas.
  - Popular/Manrique/Doce de Octubre están a 1.5-2.1 km de la estación más
    cercana (zona urbana continua) -> interpolación defendible, confianza
    "media".
  - Altavista/San Antonio de Prado/San Sebastián de Palmitas están a 6.6-6.7
    km (terreno de ladera/rural) -> NO se interpola para esas (fuera de
    alcance de este script, deliberadamente).

METODOLOGÍA IDW:
  - Centroide real de cada comuna: se calcula con geopandas sobre el CRS
    proyectado original del shapefile (EPSG:9377, metros) para que el
    centroide sea geométricamente correcto, y luego se reproyecta a WGS84
    (EPSG:4326) solo para reportarlo/comparar con lat/lon de estaciones.
  - Distancia: geodésica (great-circle, fórmula de Haversine) entre el
    centroide (WGS84) y cada estación SIATA real (WGS84), en kilómetros.
  - Vecinas: las 4 estaciones SIATA reales (de las 14 conocidas en
    auditoria_estaciones_comunas.csv) más cercanas al centroide, EXCLUYENDO
    estaciones fuera de Medellín (ninguna aquí lo está) y sin importar su
    comuna asignada (el join real ya se hizo aparte; aquí solo importa la
    distancia geográfica).
  - Peso: IDW clásico con exponente p=2 (inverso de la distancia al
    cuadrado), es decir peso_i = 1 / distancia_i^2, valor = sum(peso_i *
    valor_i) / sum(peso_i). Exponente 2 (no 1) porque penaliza más fuerte la
    influencia de estaciones lejanas, apropiado dado que ya sabemos que
    ninguna estación está realmente dentro de la comuna (se prioriza cercanía
    real sobre suavizado).
  - Valor base por estación: última lectura horaria no nula de
    `Solicitud_PM25_DP1763941.csv` (misma función que
    `app/services/data_loader.py::load_estaciones_pm25`, replicada aquí en
    pandas puro para no depender de FastAPI en un script de solo cálculo).

SANITY CHECK OBLIGATORIO: el valor IDW de cada comuna debe caer dentro de
[min, max] de las estaciones vecinas usadas (propiedad matemática de un
promedio ponderado con pesos positivos) — se verifica explícitamente y el
script se detiene si falla para alguna comuna.

Persiste: backend/data/pm25_interpolado_idw.csv (archivo NUEVO, nunca
mezclado con el CSV real de mediciones).
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "backend" / "data"

RUTA_COMUNAS = DATA_DIR / "limite_catastral_de_comun.geojson"
RUTA_ESTACIONES = DATA_DIR / "auditoria_estaciones_comunas.csv"
RUTA_PM25_SERIE = DATA_DIR / "Solicitud_PM25_DP1763941.csv"
RUTA_SALIDA = DATA_DIR / "pm25_interpolado_idw.csv"

# Nombre del polígono en el geojson -> nombre "bonito" de comuna (mismo mapeo
# que recalcular_siembra_zonas_verdes_reales.py, solo las 3 que necesitamos).
COMUNAS_OBJETIVO = {
    "POPULAR": "Popular",
    "MANRIQUE": "Manrique",
    "DOCE DE OCTUBRE": "Doce de Octubre",
}

N_VECINAS = 4
EXPONENTE_IDW = 2  # 1/distancia^2


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def cargar_valor_estaciones() -> pd.DataFrame:
    """Última lectura horaria no nula por estación (misma lógica que
    load_estaciones_pm25, pandas puro)."""
    df = pd.read_csv(RUTA_PM25_SERIE)
    df["Fecha"] = pd.to_datetime(df["Fecha"])
    filas = []
    for col in df.columns:
        if col == "Fecha":
            continue
        serie = df[col]
        idx = serie.last_valid_index()
        if idx is None:
            continue
        filas.append({
            "codigo_estacion": col,
            "valor_ug_m3": float(serie.loc[idx]),
            "fecha_lectura": df.loc[idx, "Fecha"].isoformat(),
        })
    return pd.DataFrame(filas)


def main() -> None:
    print("=" * 78)
    print("IDW PM2.5 — Popular, Manrique, Doce de Octubre")
    print("=" * 78)

    # -- 1. Centroides reales (CRS proyectado, luego a WGS84) ---------------
    gdf = gpd.read_file(RUTA_COMUNAS)
    gdf_wgs = gdf.to_crs("EPSG:4326")
    centroides_proj = gdf.geometry.centroid  # EPSG:9377, geométricamente correcto
    centroides_wgs = gpd.GeoSeries(centroides_proj, crs=gdf.crs).to_crs("EPSG:4326")

    nombre_a_idx = {n: i for i, n in enumerate(gdf["nombre"])}

    centroides: dict[str, tuple[float, float]] = {}
    for nombre_geojson, nombre_comuna in COMUNAS_OBJETIVO.items():
        idx = nombre_a_idx.get(nombre_geojson)
        if idx is None:
            raise SystemExit(f"No se encontró '{nombre_geojson}' en el geojson de comunas")
        pt = centroides_wgs.iloc[idx]
        centroides[nombre_comuna] = (pt.y, pt.x)  # (lat, lon)
        print(f"Centroide {nombre_comuna}: lat={pt.y:.6f}, lon={pt.x:.6f}")

    # -- 2. Estaciones reales (14 conocidas) + valor base --------------------
    df_est = pd.read_csv(RUTA_ESTACIONES)
    df_val = cargar_valor_estaciones()
    df_est = df_est.merge(df_val, on="codigo_estacion", how="inner")
    print(f"\nEstaciones con valor disponible: {len(df_est)} / {len(pd.read_csv(RUTA_ESTACIONES))}")

    # -- 3. IDW por comuna -----------------------------------------------------
    filas_salida = []
    for comuna, (lat_c, lon_c) in centroides.items():
        df_est = df_est.copy()
        df_est["distancia_km"] = df_est.apply(
            lambda r: haversine_km(lat_c, lon_c, r["latitud"], r["longitud"]), axis=1
        )
        vecinas = df_est.nsmallest(N_VECINAS, "distancia_km").copy()
        vecinas["peso"] = 1.0 / (vecinas["distancia_km"] ** EXPONENTE_IDW)
        valor_idw = float((vecinas["peso"] * vecinas["valor_ug_m3"]).sum() / vecinas["peso"].sum())

        vmin, vmax = vecinas["valor_ug_m3"].min(), vecinas["valor_ug_m3"].max()
        dist_min = float(vecinas["distancia_km"].min())

        print(f"\n--- {comuna} ---")
        print(vecinas[["codigo_estacion", "nombre_estacion", "distancia_km", "valor_ug_m3"]]
              .to_string(index=False))
        print(f"PM2.5 IDW = {valor_idw:.4f} ug/m3  (rango vecinas: [{vmin:.4f}, {vmax:.4f}])")
        print(f"Estación real más cercana: {dist_min:.3f} km")

        # -- SANITY CHECK OBLIGATORIO --
        if not (vmin <= valor_idw <= vmax):
            raise SystemExit(
                f"SANITY CHECK FALLIDO para {comuna}: valor IDW {valor_idw} fuera de "
                f"rango [{vmin}, {vmax}]. Deteniendo — posible bug."
            )
        print("Sanity check OK: valor IDW dentro del rango de estaciones vecinas.")

        filas_salida.append({
            "comuna": comuna,
            "pm25_interpolado_ug_m3": round(valor_idw, 4),
            "n_estaciones_usadas": len(vecinas),
            "estaciones_usadas": ";".join(vecinas["codigo_estacion"].tolist()),
            "distancia_estacion_mas_cercana_km": round(dist_min, 3),
            "distancia_estacion_mas_lejana_usada_km": round(float(vecinas["distancia_km"].max()), 3),
            "valor_min_vecinas_ug_m3": round(float(vmin), 4),
            "valor_max_vecinas_ug_m3": round(float(vmax), 4),
            "exponente_idw": EXPONENTE_IDW,
            "metodo": "IDW 1/distancia^2, 4 estaciones SIATA reales mas cercanas (haversine)",
            "confianza": "media" if dist_min <= 3.0 else "baja",
        })

    df_salida = pd.DataFrame(filas_salida)
    df_salida.to_csv(RUTA_SALIDA, index=False, encoding="utf-8-sig")
    print("\n" + "=" * 78)
    print(f"PERSISTIDO: {RUTA_SALIDA}")
    print("=" * 78)
    print(df_salida.to_string(index=False))

    calcular_score_ahp(df_salida)


# ---------------------------------------------------------------------------
# Score AHP completo para estas 3 comunas, con la MISMA fórmula/pesos que
# recalcular_siembra_zonas_verdes_reales.py (W_PM25=0.45, W_DEF=0.35,
# W_AREA=0.20; Min-Max normalizado; benchmark ratio_mitigadores=30%), pero:
#   - pm25_promedio viene del IDW (no de una estación real dentro de la
#     comuna, porque no existe ninguna).
#   - ratio_mitigadores/deficit_pct se calculan aquí mismo desde el
#     inventario arbóreo real (`sau_arboles_urbanos.csv`, comuna=Popular/
#     Manrique/Doce de Octubre) cruzado con el catálogo de especies
#     mitigadoras de PM2.5 (`ARBOLES.xlsx`, hoja "ESPECIE_REDUCEN "), la
#     MISMA fuente y método que usa el script fuente del Bloque 1
#     (Visualizacion-de-datos/scripts/bloque_1/integracion_v2_pm25_arboles_medellin.py)
#     para las 11 comunas originales — no se inventa un método distinto.
#   - área apta de siembra: se reutiliza el inventario real de zonas verdes,
#     igual que recalcular_siembra_zonas_verdes_reales.py.
#   - IMPORTANTE: la normalización Min-Max de este score corre SOLO sobre
#     estas 3 comunas (no se mezcla con la población de 11 comunas del
#     pipeline original, para no alterar esa referencia) — por eso el
#     resultado NUNCA debe compararse directamente con `ranking_prioridad`
#     de `resumen_recomendacion_por_comuna.csv` o `scores_ahp_extendido_
#     sin_siembra.csv`: son 3 poblaciones de normalización distintas. Ver
#     backend/README.md.
def calcular_score_ahp(df_idw: pd.DataFrame) -> None:
    print("\n" + "=" * 78)
    print("SCORE AHP — Popular, Manrique, Doce de Octubre (fuente_score=interpolado_idw)")
    print("=" * 78)

    sys.path.insert(0, str(REPO_ROOT / "backend"))
    from app.services.ahp import _normalizar  # noqa: E402

    RUTA_MITIGADORAS_XLSX = (
        REPO_ROOT / "Visualizacion-de-datos" / "base_datos_arboles" / "ARBOLES"
        / "Data_Clean" / "ARBOLES.xlsx"
    )
    RUTA_SAU = DATA_DIR / "sau_arboles_urbanos.csv"
    RUTA_ZONAS = DATA_DIR / "inventario_zonas_verdes.geojson"
    BENCHMARK_PCT = 30.0
    W_PM25, W_DEF, W_AREA = 0.45, 0.35, 0.20

    COBER_APTA = {"Grama", "Tierra"}
    CATEGORIA_EXCLUIDA = {"ZVPrivadas", "ZVUsoPrivado", "Parqueadero"}
    SEP_MIN_GENERICA = 8.5  # misma que recalcular_siembra_zonas_verdes_reales.py

    # -- Ratio de mitigadores desde el inventario arbóreo real -------------
    df_mit_ref = pd.read_excel(RUTA_MITIGADORAS_XLSX, sheet_name="ESPECIE_REDUCEN ")
    especies_mitigadoras = set(df_mit_ref["ESPECIE"].dropna().str.strip().unique())
    print(f"Especies mitigadoras PM2.5 (catálogo): {sorted(especies_mitigadoras)}")

    df_sau = pd.read_csv(RUTA_SAU)
    comunas_objetivo = df_idw["comuna"].tolist()
    df_sau_obj = df_sau[df_sau["comuna"].isin(comunas_objetivo)].copy()
    df_sau_obj["es_mitigador"] = df_sau_obj["s_especie"].str.strip().isin(especies_mitigadoras)

    ratio_por_comuna = {}
    for comuna in comunas_objetivo:
        sub = df_sau_obj[df_sau_obj["comuna"] == comuna]
        total = len(sub)
        mitigadores = int(sub["es_mitigador"].sum())
        ratio = round(100 * mitigadores / total, 2) if total > 0 else 0.0
        ratio_por_comuna[comuna] = ratio
        print(f"  {comuna}: {total} árboles totales, {mitigadores} mitigadores -> ratio={ratio}%")

    # -- Área apta de siembra (inventario real de zonas verdes) ------------
    gdf_comunas = gpd.read_file(RUTA_COMUNAS)
    gdf_comunas["comuna_nombre"] = gdf_comunas["nombre"].map(
        {k: v for k, v in COMUNAS_OBJETIVO.items()}
    )
    gdf_zonas = gpd.read_file(RUTA_ZONAS)
    mask_cober = gdf_zonas["cober_dom"].isin(COBER_APTA)
    mask_cat = ~gdf_zonas["categoria"].isin(CATEGORIA_EXCLUIDA)
    mask_area = gdf_zonas["Shape_Area"] >= 25
    gdf_apta = gdf_zonas[mask_cober & mask_cat & mask_area].copy()

    gdf_join = gpd.sjoin(
        gdf_apta[["id_poligono", "Shape_Area", "geometry"]],
        gdf_comunas[gdf_comunas["comuna_nombre"].notna()][["comuna_nombre", "geometry"]],
        how="left", predicate="within",
    )
    gdf_join = gdf_join[gdf_join["comuna_nombre"].notna()].copy()
    gdf_join["cupo_estimado"] = (gdf_join["Shape_Area"] / (SEP_MIN_GENERICA ** 2)).apply(
        lambda x: max(0, int(x))
    )
    gdf_con_cupo = gdf_join[gdf_join["cupo_estimado"] > 0]

    area_por_comuna = gdf_con_cupo.groupby("comuna_nombre")["Shape_Area"].sum()
    n_zonas_por_comuna = gdf_con_cupo.groupby("comuna_nombre").size()

    # -- Ensamblar y normalizar (Min-Max SOLO sobre estas 3 comunas) -------
    filas = []
    for _, row in df_idw.iterrows():
        comuna = row["comuna"]
        pm25 = row["pm25_interpolado_ug_m3"]
        ratio = ratio_por_comuna.get(comuna, 0.0)
        deficit = max(0.0, round(BENCHMARK_PCT - ratio, 2))
        area_m2 = float(area_por_comuna.get(comuna, 0.0))
        filas.append({
            "comuna": comuna,
            "pm25_promedio": pm25,
            "ratio_mitigadores": ratio,
            "deficit_pct": deficit,
            "area_apta_m2": area_m2,
            "n_zonas_disponibles": int(n_zonas_por_comuna.get(comuna, 0)),
        })

    df_score = pd.DataFrame(filas)
    df_score["n_pm25"] = _normalizar(df_score["pm25_promedio"].tolist())
    df_score["n_def"] = _normalizar(df_score["deficit_pct"].tolist())
    df_score["n_area"] = _normalizar(df_score["area_apta_m2"].tolist())
    df_score["score_multicriteria"] = (
        W_PM25 * df_score["n_pm25"] + W_DEF * df_score["n_def"] + W_AREA * df_score["n_area"]
    ).round(4)
    df_score["ranking_prioridad"] = df_score["score_multicriteria"].rank(ascending=False).astype(int)
    df_score["area_total_disponible_ha"] = (df_score["area_apta_m2"] / 10000).round(4)
    df_score["arboles_a_plantar_total"] = 0
    df_score["especie_principal"] = ""
    df_score["cupo_especie_principal"] = 0

    df_final = df_score[[
        "comuna", "ranking_prioridad", "score_multicriteria", "n_zonas_disponibles",
        "area_total_disponible_ha", "arboles_a_plantar_total", "especie_principal",
        "cupo_especie_principal", "pm25_promedio", "deficit_pct", "ratio_mitigadores",
    ]].sort_values("ranking_prioridad")

    print("\n" + df_final.to_string(index=False))

    # -- Persistir en archivo DEDICADO (no en scores_ahp_extendido_sin_siembra.csv:
    # ese archivo significa específicamente "score calculable pero 0 zonas de
    # siembra viables", y estas 3 comunas SÍ pueden tener zonas viables — mezclarlas
    # rompería la semántica del nombre del archivo). Mismas columnas para que el
    # loader las pueda tratar de forma homogénea.
    RUTA_SCORES_IDW = DATA_DIR / "scores_ahp_interpolado_idw.csv"
    df_final.to_csv(RUTA_SCORES_IDW, index=False, encoding="utf-8-sig")
    print(f"\nPERSISTIDO: {RUTA_SCORES_IDW}")

    # -- Además: archivo dedicado con metadatos IDW/confianza para las 3,
    # que el backend usa para poblar pm25_tipo_dato/pm25_confianza/
    # distancia_estacion sin tener que adivinar cuáles filas del CSV
    # combinado vienen del IDW.
    RUTA_META = DATA_DIR / "comunas_pm25_interpolado_meta.csv"
    df_meta = df_idw[[
        "comuna", "pm25_interpolado_ug_m3", "distancia_estacion_mas_cercana_km",
        "confianza", "estaciones_usadas", "exponente_idw",
    ]].copy()
    df_meta.to_csv(RUTA_META, index=False, encoding="utf-8-sig")
    print(f"PERSISTIDO: {RUTA_META}")


if __name__ == "__main__":
    main()
