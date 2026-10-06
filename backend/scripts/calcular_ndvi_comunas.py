"""NDVI (Sentinel-2 L2A) por comuna de Medellín.

Fuente: Microsoft Planetary Computer (STAC público, Sentinel-2 L2A, Copernicus).
Método: compuesto de mediana de NDVI sobre escenas con poca nube de los últimos
12 meses (máscara de nubes/sombras con la banda SCL), a 20 m, y estadística por
polígono de comuna. Requiere internet: se ejecuta en GitHub Actions, no en la API.

Uso: python scripts/calcular_ndvi_comunas.py [--meses 12] [--nube-max 40]
Salida: data/ndvi_por_comuna.csv y data/ndvi_meta.json
"""
from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import planetary_computer as pc
import pystac_client
from odc.stac import load as odc_load
from rasterio import features

DATA = Path(__file__).resolve().parent.parent / "data"
SCL_INVALIDOS = [0, 1, 3, 8, 9, 10, 11]  # sin dato, saturado, sombra, nube, cirro, nieve
UMBRAL_DENSA = 0.6


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--meses", type=int, default=12)
    ap.add_argument("--nube-max", type=float, default=40.0)
    a = ap.parse_args()

    gdf = gpd.read_file(DATA / "limite_catastral_de_comun.geojson")
    gdf = gdf.set_crs(9377, allow_override=True).to_crs(4326)
    minx, miny, maxx, maxy = gdf.total_bounds

    fin = date.today()
    ini = fin - timedelta(days=30 * a.meses)
    cat = pystac_client.Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace
    )
    items = list(
        cat.search(
            collections=["sentinel-2-l2a"],
            bbox=[minx, miny, maxx, maxy],
            datetime=f"{ini}/{fin}",
            query={"eo:cloud_cover": {"lt": a.nube_max}},
        ).items()
    )
    print(f"{len(items)} escenas candidatas")
    if not items:
        raise SystemExit("sin escenas")

    ds = odc_load(
        items,
        bands=["B04", "B08", "SCL"],
        bbox=[minx, miny, maxx, maxy],
        crs="EPSG:32618",
        resolution=20,
        groupby="solar_day",
        chunks={},
    )
    red = ds["B04"].astype("float32")
    nir = ds["B08"].astype("float32")
    # reflectancia L2A: (DN + offset)/10000; el offset cancela poco, se aplica por rigor
    red = (red - 1000) / 10000
    nir = (nir - 1000) / 10000
    ndvi = (nir - red) / (nir + red)
    valido = ~ds["SCL"].isin(SCL_INVALIDOS) & (nir + red > 0)
    ndvi = ndvi.where(valido)
    comp = ndvi.median(dim="time", skipna=True).compute()
    n_obs = valido.sum(dim="time").compute()
    arr = comp.values
    nobs = n_obs.values
    transform = comp.odc.geobox.transform
    crs = comp.odc.geobox.crs

    g = gdf.to_crs(crs)
    filas = []
    for _, r in g.iterrows():
        m = features.geometry_mask([r.geometry], out_shape=arr.shape, transform=transform, invert=True)
        v = arr[m]
        ok = v[~np.isnan(v)]
        filas.append(
            {
                "comuna": r["nombre"],
                "codigo": r["comuna"],
                "ndvi_mediana": round(float(np.median(ok)), 4) if ok.size else None,
                "ndvi_media": round(float(ok.mean()), 4) if ok.size else None,
                "pct_vegetacion_densa": round(float((ok > UMBRAL_DENSA).mean() * 100), 2) if ok.size else None,
                "pct_pixeles_validos": round(100 * ok.size / max(int(m.sum()), 1), 1),
                "obs_medianas_por_pixel": round(float(np.nanmedian(nobs[m])), 1) if m.any() else None,
            }
        )
    out = pd.DataFrame(filas)
    out.to_csv(DATA / "ndvi_por_comuna.csv", index=False)
    meta = {
        "fuente": "Sentinel-2 L2A (Copernicus) vía Microsoft Planetary Computer",
        "periodo": f"{ini}/{fin}",
        "escenas_candidatas": len(items),
        "fechas_utilizadas": int(ds.sizes["time"]),
        "resolucion_m": 20,
        "umbral_vegetacion_densa": UMBRAL_DENSA,
        "nube_max_escena_pct": a.nube_max,
        "generado": fin.isoformat(),
    }
    (DATA / "ndvi_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(out.to_string())


if __name__ == "__main__":
    main()
