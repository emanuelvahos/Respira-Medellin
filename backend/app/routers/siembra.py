from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.models.siembra import (
    RankingComunaItem,
    RecomendacionSiembraZona,
    ResumenRecomendacionComuna,
    ZonaSiembraDetalle,
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
    load_diversificacion_especies_por_id,
    load_fichas_especies,
    load_integracion_pm25_arboles,
    load_recomendacion_siembra_zona,
    load_resumen_recomendacion_comuna,
    load_scores_ahp_altavista_historico,
    load_scores_ahp_extendido_sin_siembra,
    load_scores_ahp_interpolado_idw,
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


@router.get("/zona/{id_poligono}/detalle", response_model=ZonaSiembraDetalle)
def get_zona_siembra_detalle(id_poligono: int) -> ZonaSiembraDetalle:
    """Detalle real de una zona de siembra (Fase E2): área, especie
    recomendada y su ficha botánica real (rango altitudinal, tipo de suelo,
    eficiencia de mitigación de PM2.5 cualitativa, función, fuentes) — para
    el panel de "por qué esta especie" del mapa. Ver backend/README.md,
    sección "Detalle de zona de siembra (Fase E2)" para qué se calcula y qué
    NO se calcula (no existe un valor numérico real de PM2.5 mitigado por
    individuo en ninguna fuente del proyecto)."""
    zona = next((z for z in load_recomendacion_siembra_zona() if z.id_poligono == id_poligono), None)
    if zona is None:
        raise HTTPException(
            status_code=404,
            detail=f"No existe zona de siembra con id_poligono={id_poligono}.",
        )
    ficha = load_fichas_especies().get(zona.especie_recomendada)
    diversificacion = load_diversificacion_especies_por_id().get(zona.id_poligono)
    return ZonaSiembraDetalle(
        id_poligono=zona.id_poligono,
        comuna=zona.comuna,
        categoria=zona.categoria,
        cobertura_actual=zona.cobertura_actual,
        area_m2=zona.area_m2,
        area_ha=zona.area_ha,
        especie_recomendada=zona.especie_recomendada,
        nombre_comun_especie=zona.nombre_comun_especie,
        arboles_cupo_estimado=zona.arboles_cupo_estimado,
        separacion_minima_m=zona.separacion_minima_m,
        eficiencia_pm25=zona.eficiencia_pm25,
        especies_alternativas=zona.especies_alternativas,
        fuentes_botanicas=zona.fuentes_botanicas,
        ficha_especie=ficha,
        diversificacion_disponible=bool(diversificacion and diversificacion["diversificacion_disponible"]),
        propuesta_diversificacion=(
            diversificacion["propuesta_diversificacion"]
            if diversificacion and diversificacion["diversificacion_disponible"]
            else None
        ),
        n_especies_compatibles=diversificacion["n_especies_compatibles"] if diversificacion else None,
    )


@router.get("/resumen-comuna", response_model=list[ResumenRecomendacionComuna])
def get_resumen_comuna() -> list[ResumenRecomendacionComuna]:
    """Resumen de recomendación agregado por comuna (score AHP y ranking de prioridad).

    Combina tres fuentes, distinguibles vía `fuente_score`/`tiene_zona_siembra`/
    `pm25_tipo_dato`:
    - Las 11 comunas del pipeline original (`resumen_recomendacion_por_comuna.csv`),
      con zona de siembra concreta identificada (`tiene_zona_siembra=True`,
      `pm25_tipo_dato="medido"`).
    - 4 comunas recalculadas (`scores_ahp_extendido_sin_siembra.csv`) con score
      AHP calculable (dato PM2.5 MEDIDO, disponible) pero SIN zona de siembra
      viable en el inventario real de zonas verdes (`tiene_zona_siembra=False`).
    - 3 comunas (Popular, Manrique, Doce de Octubre) SIN estación SIATA real
      dentro de su polígono: su PM2.5 es un ESTIMADO por interpolación espacial
      IDW (`scores_ahp_interpolado_idw.csv`, `pm25_tipo_dato="interpolado"`,
      `pm25_confianza="media"`) — el dato menos confiable que entra al sistema
      como estimación vigente, ver backend/README.md.
    - Altavista (`scores_ahp_altavista_historico.csv`), CUARTO nivel de
      confianza: PM2.5 REAL pero NO VIGENTE (`fuente_score=
      "historico_no_vigente"`, `pm25_tipo_dato="historico"`), promedio del
      último año de datos de la estación MED-ALTA2 (Corantioquia/SISAIRE-IDEAM)
      antes de su inactivación el `pm25_fecha_ultimo_dato`. Nunca se presenta
      con la misma confianza que un dato medido vigente o interpolado.

    San Antonio de Prado y San Sebastián de Palmitas NO aparecen aquí: no
    tienen score ni PM2.5 (brecha real de monitoreo, ver
    docs/BRECHA_MONITOREO_AIRE.md) — no se fuerza un número.

    NO afecta a `/ranking-comunas` (el comparador AHP), que sigue usando
    exclusivamente `load_resumen_recomendacion_comuna()` sin cambios.
    """
    return [
        *load_resumen_recomendacion_comuna(),
        *load_scores_ahp_extendido_sin_siembra(),
        *load_scores_ahp_interpolado_idw(),
        *load_scores_ahp_altavista_historico(),
    ]


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
