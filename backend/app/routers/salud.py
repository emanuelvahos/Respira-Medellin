from fastapi import APIRouter

from app.models.salud_respiratoria import ResumenSaludRespiratoriaResponse
from app.services.data_loader import load_salud_respiratoria_resumen

router = APIRouter(prefix="/api/salud", tags=["salud"])


@router.get("/resumen-comuna", response_model=ResumenSaludRespiratoriaResponse)
def get_resumen_comuna() -> ResumenSaludRespiratoriaResponse:
    """Carga de diagnósticos respiratorios (CIE-10 J00-J99) por comuna, red pública Metrosalud.

    Fuente independiente del modelo AHP de recomendación de siembra (que
    sigue usando exclusivamente sus datasets originales) y del inventario del
    SAU: esto es un indicador informativo adicional para el dashboard.

    El campo `metodologia` de la respuesta es obligatorio, no opcional: no es
    posible consumir este endpoint sin recibir también el caveat de que
    Metrosalud es la red pública/régimen subsidiado — no la morbilidad
    respiratoria total de Medellín.
    """
    return load_salud_respiratoria_resumen()
