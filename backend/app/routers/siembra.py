from fastapi import APIRouter, HTTPException, Query

from app.models.siembra import (
    RankingComunaItem,
    RecomendacionSiembraZona,
    ResumenRecomendacionComuna,
)
from app.models.zona_verde import FeatureCollection, ZonaPriorizadaSiembraProperties
from app.services.ahp import (
    PESO_AREA_DEFECTO,
    PESO_DEFICIT_DEFECTO,
    PESO_PM25_DEFECTO,
    PesosInvalidosError,
    calcular_ranking_comunas,
)
from app.services.data_loader import (
    load_integracion_pm25_arboles,
    load_recomendacion_siembra_zona,
    load_resumen_recomendacion_comuna,
    load_zonas_priorizadas_siembra_geojson,
)

router = APIRouter(prefix="/api/siembra", tags=["siembra"])


@router.get("/zonas", response_model=list[RecomendacionSiembraZona])
def get_zonas_siembra(
    comuna: str | None = Query(default=None, description="Filtra por nombre de comuna"),
) -> list[RecomendacionSiembraZona]:
    """Recomendación de siembra por zona verde (~1.649 zonas)."""
    rows = load_recomendacion_siembra_zona()
    if comuna is not None:
        rows = [r for r in rows if r.comuna.lower() == comuna.lower()]
    return rows


@router.get("/zonas/geojson", response_model=FeatureCollection[ZonaPriorizadaSiembraProperties])
def get_zonas_siembra_geojson() -> FeatureCollection[ZonaPriorizadaSiembraProperties]:
    """Geometría de las zonas verdes priorizadas para siembra (GeoJSON, WGS84)."""
    raw = load_zonas_priorizadas_siembra_geojson()
    return FeatureCollection[ZonaPriorizadaSiembraProperties].model_validate(raw)


@router.get("/resumen-comuna", response_model=list[ResumenRecomendacionComuna])
def get_resumen_comuna() -> list[ResumenRecomendacionComuna]:
    """Resumen de recomendación agregado por comuna (score AHP y ranking de prioridad)."""
    return load_resumen_recomendacion_comuna()


@router.get("/ranking-comunas", response_model=list[RankingComunaItem])
def get_ranking_comunas(
    peso_pm25: float = Query(default=PESO_PM25_DEFECTO, ge=0, le=1),
    peso_deficit: float = Query(default=PESO_DEFICIT_DEFECTO, ge=0, le=1),
    peso_area: float = Query(default=PESO_AREA_DEFECTO, ge=0, le=1),
) -> list[RankingComunaItem]:
    """Recalcula el ranking AHP de comunas con pesos custom (comparador de escenarios).

    Replica la fórmula exacta del script fuente del Bloque 2 (Min-Max +
    combinación ponderada, ver `app/services/ahp.py`). Los pesos deben sumar
    1.0; si no, responde 422 en vez de normalizar silenciosamente.
    """
    try:
        return calcular_ranking_comunas(
            load_resumen_recomendacion_comuna(),
            load_integracion_pm25_arboles(),
            load_recomendacion_siembra_zona(),
            peso_pm25=peso_pm25,
            peso_deficit=peso_deficit,
            peso_area=peso_area,
        )
    except PesosInvalidosError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
