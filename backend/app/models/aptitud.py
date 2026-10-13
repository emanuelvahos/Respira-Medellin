from pydantic import BaseModel


class CapaTerreno(BaseModel):
    id: str
    nombre: str
    url: str
    registros: int
    estado: str


class MetricasTerreno(BaseModel):
    pendiente_media_grados: float | None
    pendiente_p90_grados: float | None
    fraccion_amenaza_mov_masa_alta: float
    fraccion_amenaza_inundacion_alta: float
    fraccion_amenaza_torrencial_alta: float
    fraccion_riesgo_no_mitigable: float
    fraccion_retiro_quebrada: float
    fraccion_franja_tension: float
    anden_ancho_m: float | None
    redes_cercanas: list[str]


class ZonaAptitud(BaseModel):
    """Nivel 1 (aptitud de la zona) y estado del nivel 2 (puntos indicativos)."""

    id_poligono: int
    aptitud: str  # apta | apta_con_condiciones | no_apta
    motivos_no_apta: list[str]
    condiciones: list[str]
    metricas: MetricasTerreno
    razones_especie: list[str]
    puntos_indicativos: int
    cupo_estimado_previo: int | None
    puntos_publicos: bool
    avisos: list[str]
    fecha_consulta: str


class ResumenAptitud(BaseModel):
    fecha_consulta: str
    zonas: int
    apta: int
    apta_con_condiciones: int
    no_apta: int
    puntos_indicativos: int
    puntos_publicos: bool
    capas: list[CapaTerreno]
    umbrales: dict[str, float]
    avisos: list[str]
