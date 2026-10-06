from fastapi import APIRouter, HTTPException, Query

from app.models.arbol_sau import BalanceSau, ClusterArboles, PuntosArbolesResponse, ResumenArbolesComuna
from app.services.arboles import (
    DEFAULT_CLUSTER_CELL_DEG,
    MAX_PUNTOS_POR_REQUEST,
    clusters_grid,
    puntos_en_bbox,
    resumen_por_comuna,
)
from app.models.arbol_sau import ArbolesComunaDetalle
from app.models.ndvi import NdviResumen
from app.services.ndvi import ndvi_resumen
from app.services.arboles_detalle import detalle_comunas
from app.services.data_loader import load_arboles_sau_balance, load_arboles_sau_df

router = APIRouter(prefix="/api/arboles", tags=["arboles"])


@router.get("/resumen-comuna", response_model=list[ResumenArbolesComuna])
def get_resumen_comuna() -> list[ResumenArbolesComuna]:
    """Conteo real de árboles por comuna, top 5 especies y % de estado fitosanitario.

    Fuente: inventario real del SAU (árboles vivos de Medellín, capa Estado),
    no el pipeline original de `base_datos_arboles`. Agregado liviano pensado para el
    dashboard — ver `/api/arboles/clusters` y `/api/arboles/puntos` para el
    mapa.
    """
    df = load_arboles_sau_df()
    return resumen_por_comuna(df)


@router.get("/balance", response_model=BalanceSau)
def get_balance() -> BalanceSau:
    """Balance transparente del inventario SAU de Medellín: vivos, talados,
    desaparecidos, muertos e históricos (total y por comuna), criterio de
    "árbol vivo" y fechas de corte de la fuente."""
    return load_arboles_sau_balance()


@router.get("/comunas-detalle", response_model=list[ArbolesComunaDetalle])
def get_comunas_detalle() -> list[ArbolesComunaDetalle]:
    """Detalle de árboles vivos por comuna (SAU): densidad, % de especies
    mitigadoras, estado, barrios y una explicación en lenguaje claro de por qué
    la comuna ocupa su posición en la prioridad AHP v2."""
    return detalle_comunas()


@router.get("/ndvi", response_model=NdviResumen)
def get_ndvi() -> NdviResumen:
    """NDVI Sentinel-2 por comuna (evidencia satelital complementaria) y su
    relación con los árboles del SAU. No es prueba de impacto sobre el PM2.5."""
    return ndvi_resumen()


@router.get("/clusters", response_model=list[ClusterArboles])
def get_clusters(
    cell_size_deg: float = Query(
        default=DEFAULT_CLUSTER_CELL_DEG,
        gt=0,
        le=1,
        description="Tamaño de celda del grid en grados (~0.01 ≈ 1.1km en Medellín)",
    ),
) -> list[ClusterArboles]:
    """Clustering espacial en grid: centroide + conteo por celda (para zooms alejados del mapa).

    Nunca devuelve puntos individuales — el número de celdas es proporcional
    al área cubierta, no al número de árboles, así que el payload se mantiene
    pequeño sin importar la densidad real del inventario.
    """
    df = load_arboles_sau_df()
    return clusters_grid(df, cell_size_deg=cell_size_deg)


@router.get("/puntos", response_model=PuntosArbolesResponse)
def get_puntos(
    min_lon: float = Query(...),
    min_lat: float = Query(...),
    max_lon: float = Query(...),
    max_lat: float = Query(...),
    limit: int = Query(default=MAX_PUNTOS_POR_REQUEST, gt=0, le=MAX_PUNTOS_POR_REQUEST),
) -> PuntosArbolesResponse:
    """Árboles individuales reales dentro del viewport actual (bbox), con tope duro de resultados.

    Pensado para zoom cercano (nivel comuna/barrio) — a zoom alejado usar
    `/api/arboles/clusters` en su lugar. Si `truncado=true`, hay más árboles
    en el bbox que `limit`: el frontend debe pedirle al usuario que acerque
    más el zoom.
    """
    df = load_arboles_sau_df()
    try:
        puntos, truncado = puntos_en_bbox(df, min_lon, min_lat, max_lon, max_lat, limit=limit)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return PuntosArbolesResponse(puntos=puntos, truncado=truncado, limite=limit)
