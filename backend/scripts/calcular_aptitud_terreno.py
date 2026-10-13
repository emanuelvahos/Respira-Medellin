"""Aptitud del terreno por zona (nivel 1) y puntos indicativos de siembra (nivel 2).

Descarga las capas oficiales de la Alcaldía de Medellín (requiere internet: se ejecuta en
GitHub Actions), las cruza con las 1.648 zonas de siembra y escribe:

- data/aptitud_terreno_por_zona.csv      (nivel 1: apta / apta con condiciones / no apta + motivos)
- data/puntos_indicativos_siembra.geojson (nivel 2: puntos INDICATIVOS, WGS84)
- data/capas_terreno_manifest.json       (fuente, fecha de consulta, n.º de registros y hash por capa)

Los umbrales son criterio propio de EcoData Lab (no norma oficial); ver docs/J2_APTITUD_TERRENO.md.
Uso: python scripts/calcular_aptitud_terreno.py [--salida data]
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import time
from datetime import date
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from shapely.geometry import MultiPoint, Point
from shapely.ops import unary_union

BASE = "https://www.medellin.gov.co/servidormapas/rest/services"
CRS = 9377

# ---- Umbrales (criterio propio; ajustables y documentados) -----------------------------
PEND_CONDICION = 20.0  # grados: desde aquí, siembra con condiciones
PEND_NO_APTA = 35.0  # grados (media de la zona): no apta
FRAC_MINIMA = 0.05  # fracción del área de la zona para que una capa cuente como afectación
FRAC_NO_APTA_RIESGO = 0.5
FRAC_NO_APTA_TENSION = 0.6
DIST_POSTE_M = 3.0
DIST_RED_AGUA_M = 2.0
DIST_RED_GAS_ENERGIA_M = 3.0
MARGEN_BORDE_M = 1.0
DIST_ZONA_RED_M = 5.0  # redes a menos de esto del polígono se marcan como posible interferencia

CAPAS = {
    "mov_masa": ("ambiente_dllo_sost/VA_DGRD/MapServer/6", "Amenaza por movimiento en masa"),
    "inundacion": ("ambiente_dllo_sost/VA_DGRD/MapServer/5", "Amenaza por inundación"),
    "torrencial": ("ambiente_dllo_sost/VA_DGRD/MapServer/4", "Amenaza por avenida torrencial"),
    "riesgo_mm": ("ambiente_dllo_sost/VA_DGRD/MapServer/9", "Riesgo por movimiento en masa"),
    "retiros": ("ordenamiento_ter/VM_04_Estructura_Ecologica_Principal/MapServer/8", "Retiros a quebradas"),
    "tension": ("ambiente_dllo_sost/VA_SistemaArbolUrbano_Contrato/MapServer/6", "Influencia de redes de tensión"),
    "anden": ("mapas_nacionales/VC_Infraestructura_Fisica/MapServer/0", "Andenes"),
    "poste": ("vivienda_ciudad_terri/VM_Alumbrado_Publico/MapServer/1", "Postes de alumbrado"),
    "redes": ("ordenamiento_ter/VM_15_Subs_Servicios_Publicos/MapServer/7", "Redes de servicios (POT, 2014)"),
}
SLOPE_URL = f"{BASE}/ServiciosImagen/Modelo_digital_de_pendiente_gr_AMVA/ImageServer"


# ---- Descarga ---------------------------------------------------------------------------
def _get(session, url, params, tries=4):
    err = ""
    for i in range(tries):
        try:
            r = session.get(url, params=params, timeout=120)
            if r.status_code == 200:
                return r
            err = f"HTTP {r.status_code}"
        except Exception as e:  # noqa: BLE001
            err = str(e)[:150]
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"{url}: {err}")


def descargar_capa(session, ruta: str, bounds) -> gpd.GeoDataFrame:
    url = f"{BASE}/{ruta}/query"
    xmin, ymin, xmax, ymax = bounds
    env = json.dumps({"xmin": xmin, "ymin": ymin, "xmax": xmax, "ymax": ymax, "spatialReference": {"wkid": CRS}})
    feats, offset = [], 0
    while True:
        r = _get(session, url, {
            "f": "geojson", "where": "1=1", "geometry": env, "geometryType": "esriGeometryEnvelope",
            "inSR": CRS, "outSR": CRS, "spatialRel": "esriSpatialRelIntersects", "outFields": "*",
            "returnGeometry": "true", "resultOffset": offset, "resultRecordCount": 2000,
            "orderByFields": "objectid",
        })
        j = r.json()
        page = j.get("features", [])
        feats += page
        if not page or not (j.get("exceededTransferLimit") or j.get("properties", {}).get("exceededTransferLimit")):
            if len(page) < 2000:
                break
        offset += len(page)
        if offset > 400_000:
            break
    if not feats:
        return gpd.GeoDataFrame(geometry=[], crs=CRS)
    gdf = gpd.GeoDataFrame.from_features(feats, crs=CRS)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty]
    return gdf.explode(index_parts=False).reset_index(drop=True)


def descargar_pendiente(session, bounds, px=10.0068, tile=1500):
    """Mosaico de pendiente (grados) del ImageServer. Devuelve (array, (xmin, ymax), px)."""
    import tifffile

    xmin, ymin, xmax, ymax = bounds
    pad = 50
    xmin, ymin, xmax, ymax = xmin - pad, ymin - pad, xmax + pad, ymax + pad
    w = int(np.ceil((xmax - xmin) / px))
    h = int(np.ceil((ymax - ymin) / px))
    mosaico = np.full((h, w), np.nan, dtype="float32")
    for r0 in range(0, h, tile):
        for c0 in range(0, w, tile):
            th, tw = min(tile, h - r0), min(tile, w - c0)
            bx0, bx1 = xmin + c0 * px, xmin + (c0 + tw) * px
            by1, by0 = ymax - r0 * px, ymax - (r0 + th) * px
            r = _get(session, f"{SLOPE_URL}/exportImage", {
                "f": "image", "bbox": f"{bx0},{by0},{bx1},{by1}", "bboxSR": CRS, "imageSR": CRS,
                "size": f"{tw},{th}", "format": "tiff", "pixelType": "F32", "noData": -9999,
                "noDataInterpretation": "esriNoDataMatchAny", "interpolation": "RSP_NearestNeighbor",
            })
            arr = tifffile.imread(io.BytesIO(r.content)).astype("float32")
            if arr.ndim == 3:
                arr = arr[0] if arr.shape[0] < arr.shape[-1] else arr[..., 0]
            arr = arr[:th, :tw]
            arr[(arr < 0) | (arr > 90)] = np.nan
            mosaico[r0:r0 + arr.shape[0], c0:c0 + arr.shape[1]] = arr
    return mosaico, (xmin, ymax), px


# ---- Cálculo (puro: se prueba sin red) --------------------------------------------------
def muestrear_pendiente(geom, mosaico, origen, px):
    """Media y percentil 90 de la pendiente (grados) dentro del polígono."""
    ox, oy = origen
    x0, y0, x1, y1 = geom.bounds
    c0, c1 = int((x0 - ox) // px), int((x1 - ox) // px) + 1
    r0, r1 = int((oy - y1) // px), int((oy - y0) // px) + 1
    c0, r0 = max(c0, 0), max(r0, 0)
    c1, r1 = min(c1, mosaico.shape[1]), min(r1, mosaico.shape[0])
    if c1 <= c0 or r1 <= r0:
        return None, None
    cols, rows = np.meshgrid(np.arange(c0, c1), np.arange(r0, r1))
    xs, ys = ox + (cols + 0.5) * px, oy - (rows + 0.5) * px
    dentro = shapely.contains_xy(geom, xs.ravel(), ys.ravel())
    vals = mosaico[rows.ravel()[dentro], cols.ravel()[dentro]]
    if vals.size == 0:  # zona más pequeña que un píxel: píxel del centroide
        c = geom.representative_point()
        cc, rr = int((c.x - ox) // px), int((oy - c.y) // px)
        if 0 <= rr < mosaico.shape[0] and 0 <= cc < mosaico.shape[1]:
            vals = np.array([mosaico[rr, cc]])
    vals = vals[np.isfinite(vals)]
    if vals.size == 0:
        return None, None
    return float(vals.mean()), float(np.percentile(vals, 90))


def _frac(geom, capa: gpd.GeoDataFrame, sindex, mascara=None) -> float:
    """Fracción del área de `geom` cubierta por la capa (o por la parte que cumple `mascara`)."""
    if capa is None or capa.empty or geom.area == 0:
        return 0.0
    idx = sindex.query(geom, predicate="intersects")
    if len(idx) == 0:
        return 0.0
    sub = capa.iloc[idx]
    if mascara is not None:
        sub = sub[mascara.iloc[idx].values]
        if sub.empty:
            return 0.0
    return min(1.0, geom.intersection(unary_union(sub.geometry.values)).area / geom.area)


def _grado(df, col="grado_amenaza"):
    return df[col].astype(str).str.strip().str.lower() if col in df.columns else pd.Series("", index=df.index)


def evaluar_zona(geom, c, pend):
    """Aplica las reglas de nivel 1. Devuelve (aptitud, motivos, condiciones, métricas)."""
    m = {}
    mm, inu, tor, rie = c["mov_masa"], c["inundacion"], c["torrencial"], c["riesgo_mm"]
    m["frac_mm_alta"] = _frac(geom, mm, c["_si_mov_masa"], _grado(mm) == "alta")
    m["frac_inundacion_alta"] = _frac(geom, inu, c["_si_inundacion"], _grado(inu) == "alta")
    m["frac_torrencial_alta"] = _frac(geom, tor, c["_si_torrencial"], _grado(tor) == "alta")
    rr = rie["riesgo"].astype(str).str.strip().str.lower() if "riesgo" in rie.columns else pd.Series("", index=rie.index)
    m["frac_riesgo_no_mitigable"] = _frac(geom, rie, c["_si_riesgo_mm"], rr == "alto riesgo no mitigable")
    m["frac_riesgo_mitigable"] = _frac(geom, rie, c["_si_riesgo_mm"], rr.isin(["alto riesgo mitigable", "con condiciones de riesgo"]))
    m["frac_retiro_quebrada"] = _frac(geom, c["retiros"], c["_si_retiros"])
    m["frac_franja_tension"] = _frac(geom, c["tension"], c["_si_tension"])
    m["pend_media_grados"], m["pend_p90_grados"] = pend

    no, cond = [], []
    pm = m["pend_media_grados"]
    if pm is not None and pm >= PEND_NO_APTA:
        no.append(f"Pendiente media de {pm:.0f}° (límite {PEND_NO_APTA:.0f}°)")
    elif pm is not None and pm >= PEND_CONDICION:
        cond.append(f"Pendiente media de {pm:.0f}°: requiere terrazas o técnica de ladera")
    if m["frac_riesgo_no_mitigable"] >= FRAC_NO_APTA_RIESGO:
        no.append("Zona en alto riesgo no mitigable por movimiento en masa")
    elif m["frac_riesgo_no_mitigable"] >= FRAC_MINIMA or m["frac_riesgo_mitigable"] >= FRAC_MINIMA:
        cond.append("Parte de la zona está en condición de riesgo: requiere concepto de Gestión del Riesgo (DAGRD)")
    if m["frac_mm_alta"] >= FRAC_NO_APTA_RIESGO and pm is not None and pm >= 25:
        no.append("Amenaza alta por movimiento en masa sobre más de la mitad de la zona, con pendiente fuerte")
    elif m["frac_mm_alta"] >= FRAC_MINIMA:
        cond.append("Amenaza alta por movimiento en masa en parte de la zona: especies de raíz profunda y concepto técnico")
    if max(m["frac_inundacion_alta"], m["frac_torrencial_alta"]) >= FRAC_MINIMA:
        cond.append("Amenaza alta por inundación o avenida torrencial: solo especies tolerantes a suelo saturado")
    if m["frac_retiro_quebrada"] >= FRAC_MINIMA:
        cond.append("Dentro de retiro a quebrada: solo especies nativas riparias y con autorización ambiental")
    if m["frac_franja_tension"] >= FRAC_NO_APTA_TENSION:
        no.append("Más del 60 % de la zona está bajo la franja de seguridad de una línea de tensión")
    elif m["frac_franja_tension"] >= FRAC_MINIMA:
        cond.append("Franja de seguridad de línea de tensión en parte de la zona: no sembrar bajo la línea")
    # Redes de servicios (POT, 2014): solo aviso
    redes = c["redes"]
    tipos = []
    if not redes.empty:
        idx = c["_si_redes"].query(geom.buffer(DIST_ZONA_RED_M), predicate="intersects")
        if len(idx):
            tipos = sorted(set(redes.iloc[idx]["tipo_servicio"].astype(str)))
    m["redes_cercanas"] = "|".join(tipos)
    if tipos:
        cond.append(f"Posible interferencia con redes ({', '.join(t.lower() for t in tipos)}; dato 2014): requiere concepto de EPM")
    if pm is None:
        cond.append("Sin dato de pendiente en esta zona")
    aptitud = "no_apta" if no else ("apta_con_condiciones" if cond else "apta")
    return aptitud, no, cond, m


def anden_ancho(geom, anden, sindex):
    if anden is None or anden.empty:
        return None
    idx = sindex.query(geom.buffer(10), predicate="intersects")
    if len(idx) == 0:
        return None
    v = pd.to_numeric(anden.iloc[idx]["ancho"], errors="coerce")
    v = v[(v > 0) & (v < 30)]
    return float(v.median()) if len(v) else None


def generar_puntos(geom, sep, cupo, exclusion, arboles_existentes):
    """Rejilla hexagonal dentro de la zona (con margen), sin los puntos que chocan con `exclusion`."""
    util = geom.buffer(-MARGEN_BORDE_M)
    descartes = {"borde": 0, "exclusion": 0}
    if util.is_empty:
        util = geom if geom.area >= sep * sep * 0.5 else None
        if util is None:
            return [], descartes
    x0, y0, x1, y1 = util.bounds
    mejor = []
    for dx, dy in ((0, 0), (sep / 2, 0), (0, sep / 2), (sep / 2, sep / 2)):
        pts = []
        fila = 0
        y = y0 + dy
        while y <= y1:
            x = x0 + dx + (sep / 2 if fila % 2 else 0)
            while x <= x1:
                pts.append((x, y))
                x += sep
            y += sep * 0.866
            fila += 1
        if not pts:
            continue
        xs, ys = np.array(pts).T
        dentro = shapely.contains_xy(util, xs, ys)
        libres = []
        for (px_, py_), ok in zip(pts, dentro):
            if not ok:
                continue
            p = Point(px_, py_)
            if exclusion is not None and exclusion.contains(p):
                descartes["exclusion"] += 1
                continue
            if arboles_existentes is not None and arboles_existentes.size:
                d = np.hypot(arboles_existentes[:, 0] - px_, arboles_existentes[:, 1] - py_)
                if (d < sep / 2).any():
                    descartes["exclusion"] += 1
                    continue
            libres.append((px_, py_))
        if len(libres) > len(mejor):
            mejor = libres
    if not mejor and util.area >= sep * sep * 0.5:  # zona chica: un solo punto representativo
        p = util.representative_point()
        if not (exclusion is not None and exclusion.contains(p)):
            mejor = [(p.x, p.y)]
    return mejor[: max(int(cupo), 0)], descartes


def procesar(zonas, recom, capas, mosaico, origen, px, arboles_xy):
    """Devuelve (DataFrame de aptitud, GeoDataFrame de puntos en CRS 9377)."""
    c = dict(capas)
    for k in list(capas):
        c[f"_si_{k}"] = capas[k].sindex if not capas[k].empty else None
    # Exclusiones para el nivel 2 (se construyen una sola vez, con índice espacial)
    poste_buf = capas["poste"].geometry.buffer(DIST_POSTE_M) if not capas["poste"].empty else None
    redes = capas["redes"]
    agua = redes[redes["tipo_servicio"].isin(["Alcantarillado", "Acueducto"])] if not redes.empty else redes
    otras = redes[redes["tipo_servicio"].isin(["Gas", "Energía"])] if not redes.empty else redes
    excl_gdf = []
    if poste_buf is not None:
        excl_gdf.append(gpd.GeoSeries(poste_buf.values, crs=CRS))
    if not agua.empty:
        excl_gdf.append(gpd.GeoSeries(agua.geometry.buffer(DIST_RED_AGUA_M).values, crs=CRS))
    if not otras.empty:
        excl_gdf.append(gpd.GeoSeries(otras.geometry.buffer(DIST_RED_GAS_ENERGIA_M).values, crs=CRS))
    if not capas["tension"].empty:
        excl_gdf.append(gpd.GeoSeries(capas["tension"].geometry.values, crs=CRS))
    excl = gpd.GeoSeries(pd.concat(excl_gdf, ignore_index=True), crs=CRS) if excl_gdf else gpd.GeoSeries([], crs=CRS)
    excl_si = excl.sindex if len(excl) else None
    anden = capas["anden"]
    anden_si = anden.sindex if not anden.empty else None
    arb_si = None
    filas, puntos = [], []
    rec = recom.set_index("id_poligono")
    for _, z in zonas.iterrows():
        zid = int(z["id_poligono"])
        g = z.geometry
        pend = muestrear_pendiente(g, mosaico, origen, px)
        apt, no, cond, m = evaluar_zona(g, c, pend)
        info = rec.loc[zid] if zid in rec.index else None
        fila = {"id_poligono": zid, "aptitud": apt, "motivos_no_apta": " | ".join(no), "condiciones": " | ".join(cond),
                "anden_ancho_m": anden_ancho(g, anden, anden_si)}
        fila.update({k: (round(v, 3) if isinstance(v, float) else v) for k, v in m.items()})
        npts, desc = 0, {"borde": 0, "exclusion": 0}
        if info is not None and apt != "no_apta":
            sep = float(info["separacion_minima_m"])
            ex = None
            if excl_si is not None:
                idx = excl_si.query(g, predicate="intersects")
                if len(idx):
                    ex = unary_union(excl.iloc[idx].values)
            ae = None
            if arboles_xy is not None and len(arboles_xy):
                x0, y0, x1, y1 = g.bounds
                s = (arboles_xy[:, 0] > x0 - sep) & (arboles_xy[:, 0] < x1 + sep) & (arboles_xy[:, 1] > y0 - sep) & (arboles_xy[:, 1] < y1 + sep)
                ae = arboles_xy[s]
            pts, desc = generar_puntos(g, sep, int(info["arboles_cupo_estimado"]), ex, ae)
            npts = len(pts)
            for i, (px_, py_) in enumerate(pts, 1):
                puntos.append({"id_poligono": zid, "n": i, "especie": info["nombre_comun_especie"],
                               "nombre_cientifico": info["especie_recomendada"], "geometry": Point(px_, py_)})
        fila["cupo_estimado_previo"] = int(info["arboles_cupo_estimado"]) if info is not None else None
        fila["puntos_indicativos"] = npts
        fila["descartados_por_conflicto"] = desc["exclusion"]
        filas.append(fila)
    df = pd.DataFrame(filas)
    gp = gpd.GeoDataFrame(puntos, geometry="geometry", crs=CRS) if puntos else gpd.GeoDataFrame(columns=["id_poligono", "geometry"], geometry="geometry", crs=CRS)
    return df, gp


# ---- Orquestación -----------------------------------------------------------------------
def main():
    import requests

    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default="data")
    a = ap.parse_args()
    out = Path(a.salida)
    zonas = gpd.read_file(out / "zonas_priorizadas_siembra.geojson")
    if zonas.crs is None:
        zonas = zonas.set_crs(CRS)
    if zonas.crs.to_epsg() != CRS:
        zonas = zonas.to_crs(CRS)
    recom = pd.read_csv(out / "recomendacion_siembra_por_zona.csv", encoding="utf-8-sig").rename(columns={"﻿id_poligono": "id_poligono"})
    s = requests.Session()
    s.headers["User-Agent"] = "EcoDataLab-aptitud/1.0"
    b = tuple(zonas.total_bounds)
    b = (b[0] - 200, b[1] - 200, b[2] + 200, b[3] + 200)
    capas, manifest = {}, {"fecha_consulta": date.today().isoformat(), "capas": {}}
    for k, (ruta, nombre) in CAPAS.items():
        g = descargar_capa(s, ruta, b)
        capas[k] = g
        h = hashlib.sha256(pd.util.hash_pandas_object(g.geometry.to_wkb(), index=False).values.tobytes()).hexdigest()[:16] if len(g) else None
        manifest["capas"][k] = {"nombre": nombre, "url": f"{BASE}/{ruta}", "registros": int(len(g)), "hash_geometrias": h}
        print(k, len(g), flush=True)
    mosaico, origen, px = descargar_pendiente(s, tuple(zonas.total_bounds))
    manifest["pendiente"] = {"url": SLOPE_URL, "pixel_m": px, "filas": int(mosaico.shape[0]), "columnas": int(mosaico.shape[1]),
                             "pct_valido": round(float(np.isfinite(mosaico).mean()) * 100, 1)}
    arb = pd.read_csv(out / "sau_arboles_urbanos.csv", usecols=["lon", "lat", "s_estado_arbol"])
    arb = arb.dropna(subset=["lon", "lat"])
    pts = gpd.GeoSeries(gpd.points_from_xy(arb["lon"], arb["lat"]), crs=4326).to_crs(CRS)
    arboles_xy = np.column_stack([pts.x.values, pts.y.values])
    df, gp = procesar(zonas, recom, capas, mosaico, origen, px, arboles_xy)
    df.to_csv(out / "aptitud_terreno_por_zona.csv", index=False)
    gp.to_crs(4326).assign(
        x=lambda d: d.geometry.x.round(6), y=lambda d: d.geometry.y.round(6)
    ).drop(columns=["x", "y"]).to_file(out / "puntos_indicativos_siembra.geojson", driver="GeoJSON", COORDINATE_PRECISION=6)
    manifest["resumen"] = {
        "zonas": int(len(df)), **{k: int(v) for k, v in df["aptitud"].value_counts().items()},
        "puntos_indicativos": int(len(gp)),
    }
    (out / "capas_terreno_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(json.dumps(manifest["resumen"], ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())
