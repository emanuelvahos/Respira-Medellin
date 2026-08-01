from pydantic import BaseModel


class EstacionAuditoria(BaseModel):
    """Fila de auditoria_estaciones_comunas.csv: trazabilidad del join estación SIATA -> comuna.

    Nota: la columna original 'Municipio' se expone en minúscula
    ('municipio') para mantener snake_case consistente; el renombrado ocurre
    explícitamente en app.services.data_loader.
    """

    codigo_estacion: str
    nombre_estacion: str
    latitud: float
    longitud: float
    municipio: str
    estado: str
    comuna_por_gis: str
