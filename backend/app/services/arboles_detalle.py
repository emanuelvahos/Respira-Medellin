"""Detalle de árboles por comuna (SAU) + explicación de la prioridad AHP v2.

Todo se calcula a partir de datos ya cargados por el backend (sin red, sin
reprocesar el pipeline). Ver docs/AHP_V2_SAU.md y docs/H1_VERIFICACION_SAU.md.
"""

from __future__ import annotations

from functools import lru_cache

import numpy as np
import pandas as pd

from app.models.arbol_sau import (
    ArbolesComunaDetalle,
    BarrioConteo,
    ContribucionAhp,
    EspecieConteo,
    EstadoFitosanitarioResumen,
)
from app.services.comuna_join import normalize_comuna_name
from app.services.data_loader import (
    load_ahp_v2_comunas,
    load_ahp_v2_resumen,
    load_arboles_sau_balance,
    load_arboles_sau_df,
    load_poblacion_por_comuna,
)

TOP_ESPECIES = 5
TOP_BARRIOS = 10
ANIO_INICIO_SERIE = 2015
PESOS_ETIQUETA = {"pm25": "PM2.5", "deficit": "déficit de especies mitigadoras", "area": "área apta para siembra"}


def _mascara_mitigadoras(df: pd.DataFrame, especies: set[str]) -> np.ndarray:
    """Máscara booleana por fila, calculada sobre las categorías (barato con `category`)."""
    col = df["s_especie"]
    por_categoria = np.array([str(c).lower().strip() in especies for c in col.cat.categories] + [False])
    return por_categoria[col.cat.codes.to_numpy()]  # código -1 (NaN) -> último elemento (False)


def _razones(
    comuna: str,
    d,
    contrib: ContribucionAhp | None,
) -> list[str]:
    if d is None or d["score_v2_15"] is None or pd.isna(d["score_v2_15"]):
        return [
            "Esta comuna no tiene ningún dato de PM2.5 (ni estación propia ni vecinas utilizables), "
            "por lo que no se le calcula puntaje de prioridad: no se fuerza un número. "
            "Sus conteos de árboles sí son reales (SAU)."
        ]
    razones: list[str] = []
    tipo = {"medido": "dato medido por una estación propia", "interpolado": "estimado por interpolación de estaciones vecinas (confianza media)", "historico": "dato real pero no vigente (la estación dejó de operar; confianza baja)"}.get(d["pm25_tipo_dato"], str(d["pm25_tipo_dato"]))
    razones.append(
        f"Ocupa la posición {int(d['rank_v2_15'])} de 15 comunas con dato de PM2.5 (puntaje {d['score_v2_15']:.2f} de 1,00)."
    )
    assert contrib is not None
    aportes = {"pm25": contrib.pm25, "deficit": contrib.deficit, "area": contrib.area}
    principal = max(aportes, key=aportes.get)  # type: ignore[arg-type]
    razones.append(
        f"Su PM2.5 promedio es {d['pm25_promedio']:.1f} µg/m³ ({tipo}); aporta {contrib.pm25:.2f} de "
        f"{contrib.maximo_pm25:.2f} puntos posibles."
    )
    razones.append(
        f"Tiene {d['ratio_mitigadores_v2_pct']:.1f} % de especies mitigadoras entre sus árboles vivos "
        f"(referencia: 30 %); el déficit aporta {contrib.deficit:.2f} de {contrib.maximo_deficit:.2f}."
    )
    if d["tiene_zona_siembra"]:
        razones.append(
            f"Dispone de {d['area_total_disponible_ha']:.1f} ha aptas para siembra en {int(d['n_zonas_disponibles'])} "
            f"zonas verdes; el área aporta {contrib.area:.2f} de {contrib.maximo_area:.2f}."
        )
    else:
        razones.append(
            "No tiene zonas verdes viables identificadas para siembra en el inventario actual, "
            f"por lo que el área aporta {contrib.area:.2f} de {contrib.maximo_area:.2f}."
        )
    razones.append(f"El criterio que más pesa en su puntaje es {PESOS_ETIQUETA[principal]}.")
    return razones


@lru_cache
def detalle_comunas() -> list[ArbolesComunaDetalle]:
    df = load_arboles_sau_df()
    balance = load_arboles_sau_balance()
    resumen_v2 = load_ahp_v2_resumen()
    pesos = resumen_v2.pesos
    especies = set(resumen_v2.especies_mitigadoras)
    mit = _mascara_mitigadoras(df, especies)
    df = df.assign(_mit=mit)
    total_vivos = len(df)

    v2 = {normalize_comuna_name(c.comuna): c.model_dump() for c in load_ahp_v2_comunas()}
    bal = {normalize_comuna_name(k): v for k, v in balance.por_comuna.items()}
    anio_max = int(df["anio_ingreso"].max()) if "anio_ingreso" in df and df["anio_ingreso"].notna().any() else None

    res: list[ArbolesComunaDetalle] = []

    # agrupar una sola vez por comuna normalizada
    df["_key"] = df["comuna"].astype(object).map(lambda c: normalize_comuna_name(c) if isinstance(c, str) else None)
    grupos = {k: g for k, g in df.groupby("_key", observed=True)}

    for p in load_poblacion_por_comuna():
        key = normalize_comuna_name(p.nombre_comuna)
        g = grupos.get(key)
        vivos = 0 if g is None else len(g)
        b = bal.get(key)
        d = v2.get(key)

        mitigadores = 0 if g is None else int(g["_mit"].sum())
        top_esp: list[EspecieConteo] = []
        estados: list[EstadoFitosanitarioResumen] = []
        barrios: list[BarrioConteo] = []
        anios: dict[int, int] = {}
        if g is not None and vivos:
            e = (
                g[g["s_especie"].notna()]
                .groupby(["s_especie", "nombre_comun"], observed=True, dropna=False)
                .size()
                .sort_values(ascending=False)
                .head(TOP_ESPECIES)
            )
            top_esp = [EspecieConteo(especie=str(s), nombre_comun=None if pd.isna(n) else str(n), cantidad=int(c)) for (s, n), c in e.items()]
            est = g[g["s_estado_arbol"].notna()].groupby("s_estado_arbol", observed=True).size().sort_values(ascending=False)
            tot_est = int(est.sum()) or 1
            estados = [
                EstadoFitosanitarioResumen(estado=str(k), cantidad=int(v), porcentaje=round(100 * v / tot_est, 2))
                for k, v in est.items()
            ]
            bb = g[g["barrio"].notna()].groupby("barrio", observed=True).size().sort_values(ascending=False).head(TOP_BARRIOS)
            barrios = [BarrioConteo(barrio=str(k), arboles=int(v)) for k, v in bb.items()]
            ia = g["anio_ingreso"].dropna().astype(int)
            ia = ia[ia >= ANIO_INICIO_SERIE].value_counts().sort_index()
            anios = {int(k): int(v) for k, v in ia.items()}

        ultimos3 = sum(v for k, v in anios.items() if anio_max is not None and k > anio_max - 3)

        contrib = None
        if d is not None and d.get("score_v2_15") is not None and not pd.isna(d["score_v2_15"]):
            contrib = ContribucionAhp(
                pm25=round(pesos.pm25 * d["n_pm25_15"], 4),
                deficit=round(pesos.deficit * d["n_deficit_15"], 4),
                area=round(pesos.area * d["n_area_15"], 4),
                maximo_pm25=pesos.pm25,
                maximo_deficit=pesos.deficit,
                maximo_area=pesos.area,
            )
        d_clean = None
        if d is not None:
            d_clean = {k: (None if (isinstance(v, float) and pd.isna(v)) else v) for k, v in d.items()}

        res.append(
            ArbolesComunaDetalle(
                comuna=p.nombre_comuna,
                arboles_vivos=vivos,
                porcentaje_de_medellin=round(100 * vivos / total_vivos, 2) if total_vivos else 0.0,
                talados=b.talados if b else 0,
                desaparecidos=b.desaparecidos if b else 0,
                muertos=b.muertos if b else 0,
                mitigadores=mitigadores,
                ratio_mitigadores_pct=round(100 * mitigadores / vivos, 2) if vivos else None,
                poblacion=p.poblacion,
                arboles_por_1000_hab=round(1000 * vivos / p.poblacion, 1) if p.poblacion else None,
                area_km2=round(p.area_km2, 2) if p.area_km2 else None,
                arboles_por_km2=round(vivos / p.area_km2) if p.area_km2 else None,
                top_especies=top_esp,
                distribucion_estado=estados,
                top_barrios=barrios,
                registros_por_anio_ingreso=anios,
                registros_ultimos_3_anios=ultimos3,
                ranking_v2=d_clean["rank_v2_15"] if d_clean else None,
                ranking_v1=d_clean["rank_v1_11"] if d_clean else None,
                score_v2=d_clean["score_v2_15"] if d_clean else None,
                pm25_promedio=d_clean["pm25_promedio"] if d_clean else None,
                pm25_tipo_dato=d_clean["pm25_tipo_dato"] if d_clean else None,
                pm25_confianza=d_clean["pm25_confianza"] if d_clean else None,
                tiene_zona_siembra=bool(d_clean["tiene_zona_siembra"]) if d_clean else False,
                contribucion=contrib,
                razones=_razones(p.nombre_comuna, d_clean, contrib),
            )
        )
    res.sort(key=lambda r: r.arboles_vivos, reverse=True)
    return res
