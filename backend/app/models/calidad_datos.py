from typing import Literal

from pydantic import BaseModel

Estado = Literal["vigente", "atencion", "desactualizado", "sin_fecha"]
Confianza = Literal["alta", "media", "baja"]


class FuenteCalidad(BaseModel):
    id: str
    nombre: str
    proveedor: str
    usada_en: str
    fecha_corte: str | None
    antiguedad_dias: int | None
    cadencia_recomendada_dias: int
    estado: Estado
    confianza: Confianza
    registros: int | None
    cobertura: str
    actualizacion: str
    limitaciones: list[str]


class ChequeoIntegridad(BaseModel):
    id: str
    descripcion: str
    ok: bool
    detalle: str


class CalidadDatos(BaseModel):
    fecha_calculo: str
    fuentes: list[FuenteCalidad]
    chequeos: list[ChequeoIntegridad]
    resumen: str
