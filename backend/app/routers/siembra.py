from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

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
from app.services.export import build_ranking_excel, build_ranking_pdf, nombre_archivo

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


def _calcular_ranking_o_422(peso_pm25: float, peso_deficit: float, peso_area: float) -> list[RankingComunaItem]:
    """Wrapper compartido por `/ranking-comunas` y `/ranking-comunas/export`:
    misma llamada a `calcular_ranking_comunas`, mismo manejo de pesos inválidos
    — un solo lugar que traduce `PesosInvalidosError` a 422 para ambos endpoints."""
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
    return _calcular_ranking_o_422(peso_pm25, peso_deficit, peso_area)


@router.get("/ranking-comunas/export")
def export_ranking_comunas(
    formato: Literal["pdf", "excel"] = Query(...),
    peso_pm25: float = Query(default=PESO_PM25_DEFECTO, ge=0, le=1),
    peso_deficit: float = Query(default=PESO_DEFICIT_DEFECTO, ge=0, le=1),
    peso_area: float = Query(default=PESO_AREA_DEFECTO, ge=0, le=1),
) -> Response:
    """Exporta el mismo ranking de `/ranking-comunas` a PDF o Excel.

    Reutiliza `_calcular_ranking_o_422` (misma función `calcular_ranking_comunas`
    que el endpoint normal) — nunca recalcula con una lógica distinta, así que
    el archivo exportado no puede desincronizarse de lo que se ve en pantalla
    para los mismos pesos. Reporte específico del ranking AHP: no mezcla datos
    de salud respiratoria (Metrosalud) ni del inventario del SAU.
    """
    items = _calcular_ranking_o_422(peso_pm25, peso_deficit, peso_area)
    pesos = {"peso_pm25": peso_pm25, "peso_deficit": peso_deficit, "peso_area": peso_area}

    if formato == "pdf":
        content = build_ranking_pdf(items, pesos)
        media_type = "application/pdf"
    else:
        content = build_ranking_excel(items, pesos)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    filename = nombre_archivo(formato)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
