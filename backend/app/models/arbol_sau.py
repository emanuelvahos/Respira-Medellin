from pydantic import BaseModel


class ArbolSau(BaseModel):
    """Fila de sau_arboles_urbanos.csv (individuo real del SAU).

    Fuente: servicio ArcGIS REST público
    `VA_SistemaArbolUrbano_Ciudadano/MapServer/1` ("Arbol Urbano") — ver
    backend/README.md, sección "Fuente de sau_arboles_urbanos.csv".
    """

    objectid: int
    id_individuo_disperso: float | None = None
    s_especie: str | None = None
    nombre_comun: str | None = None
    tipoarbol: str | None = None
    s_estado_arbol: str | None = None
    s_estado_individuo: str | None = None
    municipio: str | None = None
    comuna: str | None = None
    barrio: str | None = None
    fecha_ingreso: str | None = None
    fecha_actualizacion: str | None = None
    lon: float
    lat: float


class EspecieConteo(BaseModel):
    especie: str
    nombre_comun: str | None = None
    cantidad: int


class EstadoFitosanitarioResumen(BaseModel):
    estado: str
    cantidad: int
    porcentaje: float


class ResumenArbolesComuna(BaseModel):
    """Agregado por comuna: conteo real, diversidad de especies y estado fitosanitario.

    Liviano a propósito (no expone geometría ni los 339.724 puntos crudos):
    es lo que alimenta el dashboard y los KPIs informativos, no el mapa de
    puntos individuales — ver /api/arboles/clusters y /api/arboles/puntos
    para eso.
    """

    comuna: str
    total_arboles: int
    top_especies: list[EspecieConteo]
    distribucion_estado: list[EstadoFitosanitarioResumen]


class ClusterArboles(BaseModel):
    """Celda de un grid espacial: centroide + conteo de árboles dentro de ella.

    Pensado para zooms alejados del mapa (análogo a los clusters
    rojos/amarillos del propio visor del SAU): nunca se envían puntos
    individuales en este endpoint, solo agregados por celda.
    """

    lon: float
    lat: float
    cantidad: int


class ArbolPunto(BaseModel):
    """Punto individual real, para el nivel de detalle de zoom cercano (viewport/bbox).

    Subconjunto de campos de ArbolSau: solo lo necesario para el tooltip del
    mapa (especie, estado, comuna) — no todos los 13 campos del CSV.
    """

    objectid: int
    s_especie: str | None = None
    nombre_comun: str | None = None
    s_estado_arbol: str | None = None
    comuna: str | None = None
    barrio: str | None = None
    lon: float
    lat: float


class PuntosArbolesResponse(BaseModel):
    """Respuesta de /api/arboles/puntos: puntos reales dentro del bbox + si se truncó."""

    puntos: list[ArbolPunto]
    truncado: bool
    limite: int
