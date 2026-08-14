from pydantic import BaseModel


class DiagnosticoConteo(BaseModel):
    """Uno de los top diagnósticos CIE-10 respiratorios de una comuna."""

    codigo: str
    nombre: str
    cantidad: int


class ResumenSaludComuna(BaseModel):
    """Carga de diagnósticos respiratorios (CIE-10 J00-J99) de una comuna, red pública Metrosalud."""

    comuna: str
    total_diagnosticos_respiratorios: int
    por_anio: dict[str, int]
    top_diagnosticos: list[DiagnosticoConteo]
    tasa_por_1000_hab: float | None = None
    """Diagnósticos ÷ población total de la comuna × 1000. `None` cuando no
    hubo cruce de nombre con poblacion_por_comuna.csv (ver `metodologia` para
    el matiz del denominador: población total, no población atendida por
    Metrosalud)."""


class FuenteSaludRespiratoria(BaseModel):
    nombre: str
    url: str
    dataset_id: str
    fecha_consulta: str
    rango_datos_fuente: str
    filtro_aplicado: str


class ResumenSaludRespiratoriaResponse(BaseModel):
    """Respuesta de /api/salud/resumen-comuna.

    `metodologia` es un campo obligatorio (no `| None`, sin default): es
    intencional que sea imposible deserializar esta respuesta sin recibir
    también el caveat metodológico — el matiz de sesgo (red pública
    Metrosalud, no morbilidad total de la ciudad) debe viajar con el dato
    en cualquier consumidor, no vivir solo en la documentación aparte.
    """

    fuente: FuenteSaludRespiratoria
    metodologia: str
    comunas: list[ResumenSaludComuna]
