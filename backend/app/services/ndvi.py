"""NDVI satelital por comuna cruzado con árboles SAU (H3).

El NDVI mide "verdor" desde el satélite (incluye pastos, cultivos, bosque y
copas). Es evidencia COMPLEMENTARIA de cobertura vegetal; no mide cuánto PM2.5
captura la vegetación ni prueba el impacto de los árboles. Los datos se
generan con scripts/calcular_ndvi_comunas.py (GitHub Actions, con internet).
"""

from __future__ import annotations

import json
from functools import lru_cache

import pandas as pd

from app.core.config import get_settings
from app.models.ndvi import NdviComuna, NdviCorrelacion, NdviResumen
from app.services.arboles_detalle import detalle_comunas
from app.services.comuna_join import normalize_comuna_name

CODIGO_MAX_URBANA = 16  # comunas 1-16; 50, 60, 70, 80, 90 son corregimientos

ADVERTENCIAS = [
    "El NDVI mide verdor visto desde el satélite: incluye pastos, cultivos, bosque y copas de árboles, no solo árboles urbanos del SAU.",
    "No mide cuánto PM2.5 captura la vegetación ni demuestra el impacto de los árboles: es evidencia complementaria de cobertura vegetal.",
    "Los corregimientos (rurales) tienen NDVI muy alto por bosque y se separan de las 16 comunas urbanas para no distorsionar la comparación.",
    "Con 16 comunas, una correlación es una pista descriptiva, no una prueba estadística.",
    "Compuesto de la mediana de las escenas sin nube del último año a 20 m; zonas con pocas observaciones son menos fiables.",
]


def _lectura(rho: float | None) -> str:
    if rho is None:
        return "Sin datos suficientes."
    a = abs(rho)
    fuerza = "muy débil" if a < 0.2 else "débil" if a < 0.4 else "moderada" if a < 0.6 else "fuerte"
    sentido = "positiva" if rho > 0 else "negativa"
    return f"Relación {fuerza} {sentido}."


@lru_cache
def ndvi_resumen() -> NdviResumen:
    s = get_settings()
    meta = json.loads(s.data_ndvi_meta.read_text(encoding="utf-8"))
    nd = pd.read_csv(s.data_ndvi_por_comuna, dtype={"codigo": str})
    det = {normalize_comuna_name(d.comuna): d for d in detalle_comunas()}
    filas: list[NdviComuna] = []
    for r in nd.itertuples():
        d = det.get(normalize_comuna_name(str(r.comuna)))
        if d is None:
            continue
        filas.append(
            NdviComuna(
                comuna=d.comuna,
                es_urbana=int(r.codigo) <= CODIGO_MAX_URBANA,
                ndvi_mediana=None if pd.isna(r.ndvi_mediana) else float(r.ndvi_mediana),
                ndvi_media=None if pd.isna(r.ndvi_media) else float(r.ndvi_media),
                pct_vegetacion_densa=None if pd.isna(r.pct_vegetacion_densa) else float(r.pct_vegetacion_densa),
                pct_pixeles_validos=float(r.pct_pixeles_validos),
                arboles_vivos=d.arboles_vivos,
                arboles_por_km2=d.arboles_por_km2,
                arboles_por_1000_hab=d.arboles_por_1000_hab,
                ratio_mitigadores_pct=d.ratio_mitigadores_pct,
            )
        )
    filas.sort(key=lambda f: -(f.ndvi_mediana or -1))
    urb = pd.DataFrame([f.model_dump() for f in filas if f.es_urbana])
    corr: list[NdviCorrelacion] = []
    for var, nombre in [
        ("arboles_por_km2", "Árboles SAU por km²"),
        ("arboles_por_1000_hab", "Árboles SAU por 1.000 habitantes"),
    ]:
        sub = urb[["ndvi_mediana", var]].dropna()
        rho = float(sub["ndvi_mediana"].rank().corr(sub[var].rank())) if len(sub) >= 5 else None
        corr.append(NdviCorrelacion(variable=nombre, n_comunas=len(sub), spearman=None if rho is None else round(rho, 2), lectura=_lectura(rho)))
    return NdviResumen(
        fuente=meta["fuente"],
        periodo=meta["periodo"],
        fechas_utilizadas=meta["fechas_utilizadas"],
        resolucion_m=meta["resolucion_m"],
        umbral_vegetacion_densa=meta["umbral_vegetacion_densa"],
        comunas=filas,
        correlaciones=corr,
        advertencias=ADVERTENCIAS,
    )
