from pydantic import BaseModel


class ArbolSau(BaseModel):
    """Fila de sau_arboles_urbanos.csv: un árbol VIVO de Medellín (SAU).

    Fuente (desde H1, 2026-10): servicio ArcGIS REST público
    `VA_SistemaArbolUrbano_Contrato/MapServer/3` ("Arboles Estado"), solo
    municipio Medellín, un registro por individuo, solo árboles vivos (activos
    y no muertos/desaparecidos). Talados y desaparecidos NO están en este
    archivo: se cuentan en sau_arboles_balance.json. Ver docs/H1_VERIFICACION_SAU.md.
    """

    objectid: int
    s_especie: str | None = None
    nombre_comun: str | None = None
    s_estado_arbol: str | None = None
    comuna: str | None = None
    barrio: str | None = None
    anio_ingreso: int | None = None
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

    Liviano a propósito (no expone geometría ni los puntos crudos):
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


class BalanceSauComuna(BaseModel):
    """Conteo por categoría de un comuna: lo vivo se muestra, lo demás se declara."""

    vivos: int
    talados: int
    desaparecidos: int
    muertos: int
    historicos: int
    total_registrados: int


class BalanceSauTotales(BaseModel):
    filas_descargadas: int
    individuos_unicos: int
    individuos_con_varias_filas: int
    filas_sin_codigo_individuo: int
    vivos: int
    vivos_sin_geometria: int
    talados: int
    desaparecidos: int
    muertos: int
    historicos: int
    otros: int


class BalanceSau(BaseModel):
    """Balance transparente del inventario SAU de Medellín (sau_arboles_balance.json).

    Incluye metadatos de corte (fecha de descarga y fecha de actualización más
    reciente de la fuente) y el criterio exacto de "árbol vivo".
    """

    fuente: dict[str, str]
    fecha_descarga_utc: str
    fecha_actualizacion_max_fuente: str | None = None
    criterio_arbol_vivo: str
    totales: BalanceSauTotales
    por_comuna: dict[str, BalanceSauComuna]
