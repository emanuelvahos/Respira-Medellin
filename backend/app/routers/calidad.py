from fastapi import APIRouter

from app.models.calidad_datos import CalidadDatos
from app.services.calidad_datos import calcular

router = APIRouter(prefix="/api/calidad-datos", tags=["calidad"])


@router.get("", response_model=CalidadDatos)
def get_calidad_datos() -> CalidadDatos:
    """Estado de cada fuente (fecha de corte, antigüedad, confianza, limitaciones)
    y chequeos de integridad entre datasets."""
    return calcular()
