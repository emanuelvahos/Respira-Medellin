from fastapi import APIRouter, HTTPException

from app.models.comuna import EstacionAuditoria
from app.models.poblacion import PoblacionComuna
from app.models.zona_verde import ComunaProperties, FeatureCollection
from app.services.data_loader import (
    load_auditoria_estaciones_comunas,
    load_limite_catastral_comunas_geojson,
    load_poblacion_por_comuna,
)

router = APIRouter(prefix="/api/comunas", tags=["comunas"])


@router.get("/poblacion", response_model=list[PoblacionComuna])
def get_poblacion_comunas() -> list[PoblacionComuna]:
    """Población, área y densidad de las 21 comunas/corregimientos.

    Fuente: DANE - Proyecciones de población 2018-2030 (ver backend/README.md
    para el año elegido y su justificación). El cruce con el resto del
    proyecto es por nombre normalizado, no por `codigo_comuna` (ver
    app.services.comuna_join).
    """
    return load_poblacion_por_comuna()


@router.get("", response_model=FeatureCollection[ComunaProperties])
def get_comunas() -> FeatureCollection[ComunaProperties]:
    """Límite catastral de las 16 comunas + corregimientos de Medellín (GeoJSON, WGS84)."""
    raw = load_limite_catastral_comunas_geojson()
    return FeatureCollection[ComunaProperties].model_validate(raw)


@router.get("/{nombre}", response_model=FeatureCollection[ComunaProperties])
def get_comuna_by_nombre(nombre: str) -> FeatureCollection[ComunaProperties]:
    """Filtra el límite catastral por nombre de comuna (case-insensitive)."""
    collection = FeatureCollection[ComunaProperties].model_validate(
        load_limite_catastral_comunas_geojson()
    )
    features = [
        f for f in collection.features if f.properties.nombre.lower() == nombre.lower()
    ]
    if not features:
        raise HTTPException(status_code=404, detail=f"No se encontró la comuna '{nombre}'.")
    return FeatureCollection[ComunaProperties](features=features)


@router.get("/estaciones/auditoria", response_model=list[EstacionAuditoria])
def get_auditoria_estaciones() -> list[EstacionAuditoria]:
    """Trazabilidad del spatial join estación SIATA -> comuna asignada."""
    return load_auditoria_estaciones_comunas()
