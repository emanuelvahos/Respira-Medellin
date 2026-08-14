from pydantic import BaseModel


class PoblacionComuna(BaseModel):
    """Fila consolidada de poblacion_por_comuna.csv (proyecciones DANE 2018-2030,
    un año fijo elegido en el pipeline) enriquecida con área y densidad.

    `codigo_comuna` es el código numérico de Decreto 346 de 2000 (ver
    `limite_catastral_de_comun.geojson`); el cruce con el resto del proyecto
    sigue siendo por nombre normalizado (ver backend/README.md, sección
    "Cruce de comunas"), no por este código — `codigo_comuna` se expone solo
    como dato de referencia.
    """

    codigo_comuna: str
    nombre_comuna: str
    anio: int
    poblacion: int
    area_km2: float | None = None
    densidad_hab_km2: float | None = None
