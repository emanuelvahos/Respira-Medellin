"""AHP v2: mismo modelo AHP (0.45·PM2.5 + 0.35·déficit + 0.20·área) pero con el
déficit de especies mitigadoras calculado sobre el inventario SAU actual
(árboles vivos de Medellín, `sau_arboles_urbanos.csv`) en vez del Excel antiguo
del pipeline original. NO modifica ningún output del pipeline original (v1):
escribe `ahp_v2_sau_por_comuna.csv` y `ahp_v2_sau_resumen.json`, que el backend
sirve en paralelo para comparar v1 vs v2.

Decisiones metodológicas (idénticas a v1 salvo el conteo de árboles):
- Especies mitigadoras: las mismas 5 del pipeline original (hoja ESPECIE_REDUCEN):
  Zygia longifolia, Calliandra haematocephala, Bauhinia picta,
  Retrophyllum rospigliosii, Inga densiflora (coincidencia exacta de `s_especie`).
- ratio_mitigadores = 100 · mitigadoras / árboles vivos; déficit = max(0, 30 − ratio).
- Min-Max a [0, 1] sobre la población indicada (serie constante -> 0.5).
- PM2.5 y área apta: sin cambios respecto a v1 (misma fuente y mismo valor).

Se calculan dos versiones:
- `*_11`: población de las 11 comunas originales (la de v1) -> comparación
  directa, aísla el efecto de actualizar el conteo de árboles.
- `*_15`: las 15 comunas con algún dato PM2.5 (medido, interpolado o histórico),
  cada una con su nivel de confianza. Las 6 sin PM2.5 no reciben score (no se
  fuerza un número) pero sí sus conteos de árboles.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data"
ESPECIES_MITIGADORAS = {
    "zygia longifolia",
    "calliandra haematocephala",
    "bauhinia picta",
    "retrophyllum rospigliosii",
    "inga densiflora",
}
BENCHMARK_DEFICIT_PCT = 30.0
PESOS = {"pm25": 0.45, "deficit": 0.35, "area": 0.20}


def _read(name: str) -> pd.DataFrame:
    return pd.read_csv(DATA / name, encoding="utf-8-sig")


def _minmax(s: pd.Series) -> pd.Series:
    mn, mx = s.min(), s.max()
    if mx == mn:
        return pd.Series(0.5, index=s.index)
    return (s - mn) / (mx - mn)


def _score(df: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame(index=df.index)
    out["n_pm25"] = _minmax(df["pm25_promedio"])
    out["n_deficit"] = _minmax(df["deficit_v2_pct"])
    out["n_area"] = _minmax(df["area_total_disponible_ha"])
    out["score"] = PESOS["pm25"] * out["n_pm25"] + PESOS["deficit"] * out["n_deficit"] + PESOS["area"] * out["n_area"]
    out["rank"] = out["score"].rank(ascending=False, method="first").astype(int)
    return out


def main() -> None:
    sau = pd.read_csv(DATA / "sau_arboles_urbanos.csv", usecols=["s_especie", "comuna"])
    sau["mit"] = sau["s_especie"].fillna("").str.lower().str.strip().isin(ESPECIES_MITIGADORAS)
    arb = sau.groupby("comuna", observed=True).agg(arboles_vivos_sau=("mit", "size"), mitigadores_sau=("mit", "sum"))

    pob = _read("poblacion_por_comuna.csv")[["nombre_comuna", "poblacion"]].rename(columns={"nombre_comuna": "comuna"})

    # v1 + datos PM2.5 por nivel de confianza (las mismas 4 fuentes que /resumen-comuna)
    orig = _read("resumen_recomendacion_por_comuna.csv")
    orig = orig[orig["pm25_promedio"].notna()].assign(pm25_tipo_dato="medido", pm25_confianza="alta", grupo="original")
    ext = _read("scores_ahp_extendido_sin_siembra.csv").assign(pm25_tipo_dato="medido", pm25_confianza="alta", grupo="original")
    idw = _read("scores_ahp_interpolado_idw.csv").assign(pm25_tipo_dato="interpolado", pm25_confianza="media", grupo="extendida")
    alt = _read("scores_ahp_altavista_historico.csv").assign(pm25_tipo_dato="historico", pm25_confianza="baja", grupo="extendida")
    cols = [
        "comuna", "ranking_prioridad", "score_multicriteria", "n_zonas_disponibles", "area_total_disponible_ha",
        "arboles_a_plantar_total", "pm25_promedio", "deficit_pct", "ratio_mitigadores", "pm25_tipo_dato",
        "pm25_confianza", "grupo",
    ]
    base = pd.concat([d[cols] for d in (orig, ext, idw, alt)], ignore_index=True)
    base = base.rename(
        columns={
            "ranking_prioridad": "rank_v1_original",
            "score_multicriteria": "score_v1",
            "deficit_pct": "deficit_v1_pct",
            "ratio_mitigadores": "ratio_mitigadores_v1_pct",
        }
    )

    # las 6 comunas oficiales restantes sin PM2.5 (San Antonio de Prado, Palmitas, etc.): sin score
    resto = pob[~pob["comuna"].isin(base["comuna"])][["comuna"]].copy()
    resto["pm25_tipo_dato"] = "sin_dato"
    resto["pm25_confianza"] = "sin_dato"
    resto["grupo"] = "sin_pm25"
    todo = pd.concat([base, resto], ignore_index=True).merge(pob, on="comuna", how="left").merge(
        arb, left_on="comuna", right_index=True, how="left"
    )
    todo["area_total_disponible_ha"] = todo["area_total_disponible_ha"].fillna(0.0)
    todo["n_zonas_disponibles"] = todo["n_zonas_disponibles"].fillna(0).astype(int)
    todo["arboles_a_plantar_total"] = todo["arboles_a_plantar_total"].fillna(0).astype(int)
    todo["tiene_zona_siembra"] = todo["n_zonas_disponibles"] > 0
    todo["ratio_mitigadores_v2_pct"] = (100 * todo["mitigadores_sau"] / todo["arboles_vivos_sau"]).round(2)
    todo["deficit_v2_pct"] = (BENCHMARK_DEFICIT_PCT - todo["ratio_mitigadores_v2_pct"]).clip(lower=0).round(2)
    todo["arboles_por_1000_hab"] = (1000 * todo["arboles_vivos_sau"] / todo["poblacion"]).round(1)

    # --- población de las 11 comunas originales (comparación directa con v1)
    m11 = todo["grupo"] == "original"
    s11 = _score(todo[m11])
    todo.loc[m11, ["n_pm25_11", "n_deficit_11", "n_area_11", "score_v2_11", "rank_v2_11"]] = s11.values
    # --- población de las 15 comunas con PM2.5 (cada una con su nivel de confianza)
    m15 = todo["pm25_promedio"].notna()
    s15 = _score(todo[m15])
    todo.loc[m15, ["n_pm25_15", "n_deficit_15", "n_area_15", "score_v2_15", "rank_v2_15"]] = s15.values

    todo["rank_v1_11"] = todo.loc[m11, "score_v1"].rank(ascending=False, method="first")
    todo["cambio_posicion_11"] = (todo["rank_v1_11"] - todo["rank_v2_11"])  # >0: sube en v2

    for c in [c for c in todo.columns if c.startswith(("n_", "score_"))]:
        todo[c] = todo[c].round(4)
    for c in ("rank_v2_11", "rank_v2_15", "rank_v1_11", "cambio_posicion_11"):
        todo[c] = todo[c].astype("Int64")
    todo = todo.sort_values(["grupo", "rank_v2_15"], na_position="last").reset_index(drop=True)
    m11 = todo["grupo"] == "original"  # recalcular máscaras tras reordenar
    m15 = todo["pm25_promedio"].notna()
    out_cols = [
        "comuna", "grupo", "pm25_promedio", "pm25_tipo_dato", "pm25_confianza", "tiene_zona_siembra",
        "area_total_disponible_ha", "n_zonas_disponibles", "arboles_a_plantar_total", "poblacion",
        "arboles_vivos_sau", "mitigadores_sau", "arboles_por_1000_hab",
        "ratio_mitigadores_v1_pct", "deficit_v1_pct", "ratio_mitigadores_v2_pct", "deficit_v2_pct",
        "score_v1", "rank_v1_original", "rank_v1_11", "score_v2_11", "rank_v2_11", "cambio_posicion_11",
        "n_pm25_15", "n_deficit_15", "n_area_15", "score_v2_15", "rank_v2_15",
    ]
    todo[out_cols].to_csv(DATA / "ahp_v2_sau_por_comuna.csv", index=False, encoding="utf-8")

    # --- resumen de robustez v1 vs v2 (población de 11)
    a = todo.loc[m11, ["comuna", "rank_v1_11", "rank_v2_11", "score_v1", "score_v2_11"]].copy()
    rho = float(a["rank_v1_11"].astype(float).corr(a["rank_v2_11"].astype(float), method="pearson"))  # Spearman sobre rangos
    top5_v1 = set(a.nsmallest(5, "rank_v1_11")["comuna"])
    top5_v2 = set(a.nsmallest(5, "rank_v2_11")["comuna"])
    resumen = {
        "especies_mitigadoras": sorted(ESPECIES_MITIGADORAS),
        "pesos": PESOS,
        "benchmark_deficit_pct": BENCHMARK_DEFICIT_PCT,
        "arboles_v1_total_11_comunas": int(
            _read("integracion_v2_pm25_arboles_medellin.csv").query("año == 2025").drop_duplicates("comuna")["cantidad_arboles_totales"].sum()
        ),
        "arboles_vivos_sau_total_11_comunas": int(todo.loc[m11, "arboles_vivos_sau"].sum()),
        "arboles_vivos_sau_total_medellin": int(arb["arboles_vivos_sau"].sum()),
        "spearman_rank_v1_vs_v2_11": round(rho, 3),
        "top5_v1": sorted(top5_v1),
        "top5_v2": sorted(top5_v2),
        "top5_coinciden": len(top5_v1 & top5_v2),
        "rango_deficit_v2_pct": [float(todo["deficit_v2_pct"].min()), float(todo["deficit_v2_pct"].max())],
        "advertencia": (
            "El déficit v2 varía poco entre comunas (todas tienen entre ~2,5 % y ~6 % de especies mitigadoras "
            "frente al benchmark de 30 %): tras el Min-Max, diferencias pequeñas se amplifican a toda la escala [0,1]. "
            "Ver docs/VALIDACION_SENSIBILIDAD_AHP.md."
        ),
    }
    (DATA / "ahp_v2_sau_resumen.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    print(todo[out_cols[:1] + ["pm25_confianza", "arboles_vivos_sau", "deficit_v1_pct", "deficit_v2_pct", "score_v1", "rank_v1_11", "score_v2_11", "rank_v2_11", "score_v2_15", "rank_v2_15"]].to_string())
    print(json.dumps(resumen, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
