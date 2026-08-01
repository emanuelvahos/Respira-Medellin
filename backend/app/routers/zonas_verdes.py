from fastapi import APIRouter

from app.models.zona_verde import FeatureCollection, ZonaVerdeInventarioProperties
from app.services.data_loader import load_inventario_zonas_verdes_geojson

router = APIRouter(prefix="/api/zonas-verdes", tags=["zonas-verdes"])


@router.get("", response_model=FeatureCollection[ZonaVerdeInventarioProperties])
def get_zonas_verdes() -> FeatureCollection[ZonaVerdeInventarioProperties]:
    """Inventario completo de zonas verdes (GeoJSON, WGS84).

    Pendiente: el dataset fuente no existe todavía en el repo de datos
    (ver backend/README.md, sección "Dataset pendiente"). Responde 503
    explícito indicando la variable de entorno a revisar hasta que exista.
    """
    raw = load_inventario_zonas_verdes_geojson()
    return FeatureCollection[ZonaVerdeInventarioProperties].model_validate(raw)
