from fastapi import APIRouter, Query

from app.models.pm25 import EstacionPM25, IntegracionPM25Arboles, RelacionComunaAnual
from app.services.data_loader import (
    load_estaciones_pm25,
    load_integracion_pm25_arboles,
    load_relaciones_bloque2,
)

router = APIRouter(prefix="/api/pm25", tags=["pm25"])


@router.get("", response_model=list[IntegracionPM25Arboles])
def get_pm25(
    comuna: str | None = Query(default=None, description="Filtra por nombre de comuna"),
    anio: int | None = Query(default=None, description="Filtra por año"),
) -> list[IntegracionPM25Arboles]:
    """PM2.5 x cobertura arbórea por comuna y periodo cuatrimestral."""
    rows = load_integracion_pm25_arboles()
    if comuna is not None:
        rows = [r for r in rows if r.comuna.lower() == comuna.lower()]
    if anio is not None:
        rows = [r for r in rows if r.anio == anio]
    return rows


@router.get("/estaciones", response_model=list[EstacionPM25])
def get_estaciones_pm25() -> list[EstacionPM25]:
    """Última lectura real de PM2.5 por estación SIATA (no agregada por comuna).

    Pensado para capas que necesitan variación espacial genuina (p. ej. un
    campo de partículas animado), a diferencia de `/api/pm25`, que agrega por
    comuna y periodo.
    """
    return load_estaciones_pm25()


@router.get("/relaciones-anuales", response_model=list[RelacionComunaAnual])
def get_relaciones_anuales(
    comuna: str | None = Query(default=None, description="Filtra por nombre de comuna"),
    anio: int | None = Query(default=None, description="Filtra por año"),
) -> list[RelacionComunaAnual]:
    """Relaciones anuales comuna x vulnerabilidad, insumo del recomendador AHP."""
    rows = load_relaciones_bloque2()
    if comuna is not None:
        rows = [r for r in rows if r.comuna.lower() == comuna.lower()]
    if anio is not None:
        rows = [r for r in rows if r.anio == anio]
    return rows
