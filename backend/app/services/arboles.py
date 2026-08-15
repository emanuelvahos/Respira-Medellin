"""Agregaciones sobre el inventario real del SAU (339.724 árboles).

Ningún endpoint de este módulo devuelve los 339.724 puntos crudos en una sola
respuesta — el mismo problema de framerate que causó el inventario de zonas
verdes (48.348 polígonos, ~23MB) se repetiría multiplicado ~7x aquí. En su
lugar:

- `resumen_por_comuna`: agregados livianos (conteos, top especies, % estado
  fitosanitario) — para el dashboard, no para el mapa.
- `clusters_grid`: centroides + conteo por celda de un grid espacial — para
  zooms alejados del mapa (igual que los clusters del propio visor del SAU).
- `puntos_en_bbox`: puntos individuales reales, pero solo dentro del
  viewport actual y con un tope duro de resultados — para zoom cercano.
"""

import math

import pandas as pd

from app.models.arbol_sau import (
    ArbolPunto,
    ClusterArboles,
    EspecieConteo,
    EstadoFitosanitarioResumen,
    ResumenArbolesComuna,
)

TOP_ESPECIES_N = 5

# Tope duro de puntos individuales por respuesta de /api/arboles/puntos: aun
# acotado al viewport, una comuna densa en zoom bajo podría devolver decenas
# de miles de árboles. Este límite protege el payload; el frontend debe pedir
# más zoom si necesita ver todos los árboles de una zona muy densa.
MAX_PUNTOS_POR_REQUEST = 3000

# Tamaño de celda por defecto del grid de clustering, en grados (~1.1km en la
# latitud de Medellín) — suficientemente grueso para que el número de celdas
# renderizadas en un zoom alejado sea pequeño (círculos, no miles de puntos).
DEFAULT_CLUSTER_CELL_DEG = 0.01


def resumen_por_comuna(df: pd.DataFrame) -> list[ResumenArbolesComuna]:
    resultado: list[ResumenArbolesComuna] = []
    df_validas = df[df["comuna"].notna()]
    for comuna, grupo in df_validas.groupby("comuna"):
        total = len(grupo)

        especies = (
            grupo[grupo["s_especie"].notna()]
            .groupby(["s_especie", "nombre_comun"], dropna=False)
            .size()
            .sort_values(ascending=False)
            .head(TOP_ESPECIES_N)
        )
        top_especies = [
            EspecieConteo(especie=especie, nombre_comun=nombre_comun, cantidad=int(cantidad))
            for (especie, nombre_comun), cantidad in especies.items()
        ]

        estados = (
            grupo[grupo["s_estado_arbol"].notna()]
            .groupby("s_estado_arbol")
            .size()
            .sort_values(ascending=False)
        )
        total_con_estado = int(estados.sum()) or 1
        distribucion_estado = [
            EstadoFitosanitarioResumen(
                estado=estado,
                cantidad=int(cantidad),
                porcentaje=round(100 * cantidad / total_con_estado, 2),
            )
            for estado, cantidad in estados.items()
        ]

        resultado.append(
            ResumenArbolesComuna(
                comuna=comuna,
                total_arboles=total,
                top_especies=top_especies,
                distribucion_estado=distribucion_estado,
            )
        )

    resultado.sort(key=lambda r: r.total_arboles, reverse=True)
    return resultado


def clusters_grid(
    df: pd.DataFrame,
    cell_size_deg: float = DEFAULT_CLUSTER_CELL_DEG,
) -> list[ClusterArboles]:
    if cell_size_deg <= 0:
        raise ValueError("cell_size_deg debe ser mayor que 0")

    lon = df["lon"].astype(float)
    lat = df["lat"].astype(float)
    cell_lon = (lon / cell_size_deg).apply(math.floor)
    cell_lat = (lat / cell_size_deg).apply(math.floor)

    grid = pd.DataFrame({"lon": lon, "lat": lat, "cell_lon": cell_lon, "cell_lat": cell_lat})
    agregado = grid.groupby(["cell_lon", "cell_lat"]).agg(
        lon=("lon", "mean"),
        lat=("lat", "mean"),
        cantidad=("lon", "size"),
    )

    return [
        ClusterArboles(lon=round(row.lon, 6), lat=round(row.lat, 6), cantidad=int(row.cantidad))
        for row in agregado.itertuples()
    ]


def puntos_en_bbox(
    df: pd.DataFrame,
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    limit: int = MAX_PUNTOS_POR_REQUEST,
) -> tuple[list[ArbolPunto], bool]:
    """Devuelve (puntos, truncado) — `truncado=True` si el viewport tiene más
    árboles que `limit` y la respuesta se recortó (el frontend debe indicarle
    al usuario que acerque más el zoom para ver el resto)."""
    if min_lon > max_lon or min_lat > max_lat:
        raise ValueError("bbox inválido: min debe ser <= max en cada eje")

    limit = min(limit, MAX_PUNTOS_POR_REQUEST)

    mask = (
        (df["lon"] >= min_lon)
        & (df["lon"] <= max_lon)
        & (df["lat"] >= min_lat)
        & (df["lat"] <= max_lat)
    )
    subset = df[mask]
    truncado = len(subset) > limit
    # Muestra aleatoria (no las primeras `limit` filas por orden de objectid):
    # con un bbox grande (p. ej. una comuna completa para "Respiro Urbano",
    # ver TreeInstances en el frontend) un corte posicional sesgaría la
    # muestra hacia donde el dataset fuente empieza geográficamente en vez
    # de repartirse por toda el área visible. random_state fijo: mismo bbox
    # -> misma muestra (evita parpadeo si React Query refetchea el mismo bbox).
    subset = subset if not truncado else subset.sample(n=limit, random_state=42)

    puntos = [ArbolPunto.model_validate(row) for row in subset.to_dict(orient="records")]
    return puntos, truncado
