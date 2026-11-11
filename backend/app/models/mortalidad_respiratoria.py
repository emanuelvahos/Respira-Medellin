from pydantic import BaseModel


class MortalidadRespiratoriaComuna(BaseModel):
    """Mortalidad respiratoria 2017-2021 de una comuna (MEData, Secretaría de Salud)."""

    comuna: str
    muertes_2017_2021: int
    tasa_x100mil: float
    """Muertes respiratorias por 100 mil habitantes por año. Tasa cruda."""


class MortalidadRespiratoriaResponse(BaseModel):
    """Respuesta de /api/salud/mortalidad-respiratoria.

    `metodologia` es obligatorio (sin default), igual que en
    /api/salud/resumen-comuna: el caveat viaja siempre con el dato.
    """

    fuente: str
    licencia: str
    metodologia: str
    comunas: list[MortalidadRespiratoriaComuna]
