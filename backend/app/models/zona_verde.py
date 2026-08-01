from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel

PropertiesT = TypeVar("PropertiesT", bound=BaseModel)


class Geometry(BaseModel):
    """Geometría GeoJSON cruda (Polygon/MultiPolygon/...). No se valida la
    forma interna aquí: geopandas ya garantiza que es GeoJSON válido."""

    type: str
    coordinates: Any


class Feature(BaseModel, Generic[PropertiesT]):
    type: Literal["Feature"] = "Feature"
    geometry: Geometry
    properties: PropertiesT
    id: int | str | None = None


class FeatureCollection(BaseModel, Generic[PropertiesT]):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[Feature[PropertiesT]]


class ZonaPriorizadaSiembraProperties(BaseModel):
    """properties de zonas_priorizadas_siembra.geojson.

    extra="allow": el archivo fuente trae columnas adicionales (p. ej.
    Shape_Area) que se documentan aquí solo parcialmente; se preservan sin
    truncar la respuesta.
    """

    model_config = {"extra": "allow"}

    id_poligono: int
    categoria: str
    cober_dom: str
    comuna: str
    ranking_prioridad_comuna: int
    score_multicriteria: float
    especie_recomendada: str
    nombre_comun_especie: str
    arboles_cupo_estimado: int
    eficiencia_pm25: str


class ComunaProperties(BaseModel):
    """properties de limite_catastral_de_comun.geojson.

    extra="allow": preserva columnas adicionales del shapefile de origen
    (OBJECTID, Shape_Length, Shape_Area, ...) sin truncar la respuesta.
    """

    model_config = {"extra": "allow"}

    comuna: str
    sector: int | None = None
    nombre: str
    fecha_sincronizacion: int | None = None


class ZonaVerdeInventarioProperties(BaseModel):
    """properties del inventario completo de zonas verdes.

    Placeholder: el dataset fuente (inventario_zonas_verdes.geojson) no
    existe todavía en el repo de datos — ver backend/README.md. El esquema
    se define desde ya para que el contrato quede documentado en /docs, pero
    el router responde 503 mientras el archivo no exista.
    """

    id_poligono: int
    tipo_cobertura: str
    tipologia: str
    comuna: str
