"""Descarga agregada de MEData 'Mortalidad' (Secretaría de Salud, Medellín) y calcula
muertes por enfermedades respiratorias por comuna de residencia.

Fuente: https://medata.app.medellin.gov.co/dataset/1-026-22-000161  (ficha: CC BY 4.0)
Solo se piden dos columnas (comuna_res, ano): no se descarga ni se guarda ningún dato personal.
Uso:  python scripts/fetch_mortalidad_medata.py
Salida: data/medata_mortalidad_respiratoria_comuna.csv
"""
import csv, sys, time
from collections import defaultdict
from pathlib import Path
import requests

BASE = "https://medata.app.medellin.gov.co/api/1/datastore/sql/"
RESOURCE = "72ef1d20-afd3-50cb-aeeb-059c5a1b5017"  # distribución del dataset 1-026-22-000161
SUBCATEGORIAS = [  # nom_667_ops_subc, causas respiratorias (clasificación OPS 6/67)
    "Enfermedades cronicas de las vias respiratorias inferiores",
    "Infecciones respiratorias agudas",
    "Resto de enfermedades del sistema respiratorio",
]
PAGE = 3000
DESDE = 2017  # ventana reciente de 5 años (los datos llegan a 2021)

def consulta(sub, offset):
    q = f'[SELECT comuna_res,ano FROM {RESOURCE}][WHERE nom_667_ops_subc = "{sub}"][LIMIT {PAGE} OFFSET {offset}];'
    for intento in range(4):
        r = requests.get(BASE, params={"query": q}, timeout=120)
        if r.ok:
            return r.json()
        time.sleep(3 * (intento + 1))
    sys.exit(f"MEData no respondió ({r.status_code}): {r.text[:200]}")

def main():
    todo, reciente = defaultdict(int), defaultdict(int)
    for sub in SUBCATEGORIAS:
        offset = 0
        while True:
            filas = consulta(sub, offset)
            for f in filas:
                c = f["COMUNA_RES"]
                todo[c] += 1
                if int(f["ANO"]) >= DESDE:
                    reciente[c] += 1
            if len(filas) < PAGE:
                break
            offset += PAGE
    out = Path(__file__).resolve().parent.parent / "data" / "medata_mortalidad_respiratoria_comuna.csv"
    with out.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["comuna_medata", "muertes_resp_2012_2021", f"muertes_resp_{DESDE}_2021"])
        for c in sorted(todo):
            w.writerow([c, todo[c], reciente[c]])
    print(f"OK {sum(todo.values())} defunciones respiratorias -> {out}")

if __name__ == "__main__":
    main()
