"""Procesa el Excel crudo de proyecciones de poblacion DANE y genera
backend/data/poblacion_por_comuna.csv (formato consolidado por comuna/corregimiento).

Fuente: Alcaldia de Medellin, DANE - Proyecciones de poblacion por Comunas y
Corregimientos 2018-2030, Contrato interadministrativo No. 4600104690 de 2025.
Descargado de https://www.medellin.gov.co/es/centro-documental/proyecciones-poblacion-viviendas-y-hogares/
el 2026-08-14.

Uso: .venv/Scripts/python scripts/procesar_poblacion_comunas.py
"""
import pandas as pd

RAW_PATH = "data/proyecciones_poblacion_comunas.xlsx"
OUT_PATH = "data/poblacion_por_comuna.csv"
ANIO_ELEGIDO = 2024

df = pd.read_excel(RAW_PATH, sheet_name="Comunas y Corregimientos", header=15)
df.columns = [str(c).strip() for c in df.columns]
df = df.rename(columns={"C�digo Comuna": "codigo_comuna", "Nombre Comuna": "nombre_comuna", "Area Geogr�fica": "area_geografica"})
# columnas de codigo/nombre pueden venir con encoding correcto o mojibake segun entorno; localizamos por posicion
cols = list(df.columns)
df = df.rename(columns={cols[0]: "codigo_comuna", cols[1]: "nombre_comuna", cols[2]: "area_geografica"})

df = df[df["nombre_comuna"].notna()]
df = df[df["nombre_comuna"] != "Totales"]
df = df[df["codigo_comuna"] != "Totales"]

df["codigo_comuna"] = df["codigo_comuna"].astype(str).str.strip()
df["nombre_comuna"] = df["nombre_comuna"].astype(str).str.strip()

col_anio = ANIO_ELEGIDO if ANIO_ELEGIDO in df.columns else str(ANIO_ELEGIDO)
if col_anio not in df.columns:
    raise SystemExit(f"Anio {ANIO_ELEGIDO} no encontrado en columnas: {df.columns.tolist()}")

agg = (
    df.groupby(["codigo_comuna", "nombre_comuna"], as_index=False)[col_anio]
    .sum()
    .rename(columns={col_anio: "poblacion"})
)
agg["anio"] = ANIO_ELEGIDO
agg["poblacion"] = agg["poblacion"].astype(int)
agg = agg.sort_values("codigo_comuna").reset_index(drop=True)

assert len(agg) == 21, f"Se esperaban 21 comunas/corregimientos, se obtuvieron {len(agg)}"
total = agg["poblacion"].sum()
assert 2_000_000 < total < 3_000_000, f"Suma total fuera de rango esperado: {total}"

agg.to_csv(OUT_PATH, index=False, encoding="utf-8")
print(f"OK: {len(agg)} filas, poblacion total {total}, anio {ANIO_ELEGIDO}")
print(agg.to_string())
