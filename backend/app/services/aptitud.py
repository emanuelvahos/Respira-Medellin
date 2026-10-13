"""Aptitud del terreno por zona (nivel 1) y puntos indicativos (nivel 2).

Los datos los calcula `scripts/calcular_aptitud_terreno.py` (necesita internet, corre en
GitHub Actions) y se versionan en `data/`. Aquí solo se leen y se explican. Ver
docs/J2_APTITUD_TERRENO.md. Los umbrales son criterio propio, no norma oficial.
"""

from __future__ import annotations

import json
from functools import lru_cache

import pandas as pd

from app.core.config import get_settings
from app.models.aptitud import CapaTerreno, MetricasTerreno, ResumenAptitud, ZonaAptitud
from app.services.data_loader import load_fichas_especies, load_recomendacion_siembra_zona

AVISOS_GENERALES = [
    "Las redes de servicios públicos provienen del POT (escala de ordenamiento, dato de 2014). No son un plano de detalle.",
    "Los umbrales (pendiente, fracciones de área, distancias) son criterio propio de EcoData Lab, no una norma oficial.",
    "Este análisis no reemplaza la visita técnica ni el concepto de la autoridad ambiental y de los operadores de servicios.",
]
UMBRALES = {
    "pendiente_condicion_grados": 20.0,
    "pendiente_no_apta_grados": 35.0,
    "fraccion_minima_afectacion": 0.05,
    "distancia_poste_m": 3.0,
    "distancia_red_agua_m": 2.0,
    "distancia_red_gas_energia_m": 3.0,
}
_TIPOLOGIA = {
    "AsocioMovilidad": "zona asociada a vías y movilidad (separadores, orejas, glorietas)",
    "AsocioEP": "zona asociada a espacio público de encuentro y recreación",
    "AsocioUrbanistico": "zona asociada a desarrollo urbanístico (retiros y zonas residuales)",
}


@lru_cache
def _manifest() -> dict:
    p = get_settings().data_capas_terreno_manifest
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


@lru_cache
def _tabla() -> dict[int, dict]:
    p = get_settings().data_aptitud_terreno
    if not p.exists():
        return {}
    df = pd.read_csv(p).astype(object).where(lambda d: d.notna(), None)
    return {int(r["id_poligono"]): r for r in df.to_dict(orient="records")}


@lru_cache
def _puntos() -> dict:
    p = get_settings().data_puntos_indicativos
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"type": "FeatureCollection", "features": []}


def disponible() -> bool:
    return bool(_tabla())


def puntos_publicos() -> bool:
    return bool(get_settings().puntos_indicativos_publicos)


def puntos_geojson(id_poligono: int | None = None) -> dict:
    fc = _puntos()
    if id_poligono is None:
        return fc
    return {"type": "FeatureCollection",
            "features": [f for f in fc["features"] if f["properties"].get("id_poligono") == id_poligono]}


def _lista(txt) -> list[str]:
    return [t.strip() for t in str(txt).split("|") if t and str(txt) != "None" and t.strip()]


def _razones_especie(fila: dict, r, aptitud: dict) -> list[str]:
    out = []
    tip = _TIPOLOGIA.get(r.categoria) or None
    out.append(
        f"{r.nombre_comun_especie} ({r.especie_recomendada}) se asigna por regla de EcoData Lab según el tipo de zona: "
        f"{tip or r.categoria}. Fuentes botánicas: {r.fuentes_botanicas}."
    )
    ficha = load_fichas_especies().get(r.especie_recomendada)
    if ficha:
        alt = ficha.rango_altitudinal_msnm
        out.append(
            f"Ficha de la especie: altura máxima {ficha.altura_max_m:g} m, copa {ficha.amplitud_copa}, "
            f"rango altitudinal {alt[0]}–{alt[1]} m s. n. m., eficiencia cualitativa de PM2.5 {ficha.pm25_eficiencia}."
        )
    out.append(f"Separación mínima entre árboles: {r.separacion_minima_m:g} m (según el porte de la especie).")
    pm = aptitud.get("pend_media_grados")
    if pm is not None and pm >= 20:
        out.append("Terreno inclinado: preferir individuos jóvenes y plantación en terrazas.")
    if (aptitud.get("frac_inundacion_alta") or 0) >= 0.05 or (aptitud.get("frac_torrencial_alta") or 0) >= 0.05:
        out.append("Parte de la zona tiene amenaza alta de inundación: verificar tolerancia a suelo saturado antes de sembrar.")
    if r.especies_alternativas:
        out.append(f"Alternativas compatibles: {r.especies_alternativas}.")
    out.append("Criterio propio de EcoData Lab: el Plan Distrital de Silvicultura Urbana aún no publica criterios oficiales de especie según sitio.")
    return out


def zona_aptitud(id_poligono: int) -> ZonaAptitud | None:
    fila = _tabla().get(id_poligono)
    if fila is None:
        return None
    r = next((z for z in load_recomendacion_siembra_zona() if z.id_poligono == id_poligono), None)
    f = lambda k: float(fila[k]) if fila.get(k) is not None else 0.0  # noqa: E731
    o = lambda k: float(fila[k]) if fila.get(k) is not None else None  # noqa: E731
    avisos = list(AVISOS_GENERALES)
    if fila.get("redes_cercanas"):
        avisos.insert(0, "Hay redes de servicios cerca de esta zona: se requiere concepto de interferencia antes de sembrar.")
    return ZonaAptitud(
        id_poligono=id_poligono,
        aptitud=str(fila["aptitud"]),
        motivos_no_apta=_lista(fila.get("motivos_no_apta")),
        condiciones=_lista(fila.get("condiciones")),
        metricas=MetricasTerreno(
            pendiente_media_grados=o("pend_media_grados"), pendiente_p90_grados=o("pend_p90_grados"),
            fraccion_amenaza_mov_masa_alta=f("frac_mm_alta"), fraccion_amenaza_inundacion_alta=f("frac_inundacion_alta"),
            fraccion_amenaza_torrencial_alta=f("frac_torrencial_alta"), fraccion_riesgo_no_mitigable=f("frac_riesgo_no_mitigable"),
            fraccion_retiro_quebrada=f("frac_retiro_quebrada"), fraccion_franja_tension=f("frac_franja_tension"),
            anden_ancho_m=o("anden_ancho_m"), redes_cercanas=_lista(fila.get("redes_cercanas")),
        ),
        razones_especie=_razones_especie(fila, r, fila) if r else [],
        puntos_indicativos=int(fila.get("puntos_indicativos") or 0) if puntos_publicos() else 0,
        cupo_estimado_previo=int(fila["cupo_estimado_previo"]) if fila.get("cupo_estimado_previo") is not None else None,
        puntos_publicos=puntos_publicos(),
        avisos=avisos,
        fecha_consulta=_manifest().get("fecha_consulta", ""),
    )


def resumen() -> ResumenAptitud | None:
    m = _manifest()
    if not m or not disponible():
        return None
    res = m.get("resumen", {})
    return ResumenAptitud(
        fecha_consulta=m["fecha_consulta"], zonas=res.get("zonas", 0), apta=res.get("apta", 0),
        apta_con_condiciones=res.get("apta_con_condiciones", 0), no_apta=res.get("no_apta", 0),
        puntos_indicativos=res.get("puntos_indicativos", 0) if puntos_publicos() else 0,
        puntos_publicos=puntos_publicos(),
        capas=[CapaTerreno(id=k, nombre=v["nombre"], url=v["url"], registros=v["registros"], estado=v["estado"])
               for k, v in m["capas"].items()],
        umbrales=UMBRALES, avisos=AVISOS_GENERALES,
    )
