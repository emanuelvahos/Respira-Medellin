from pydantic import BaseModel


class EstacionPM25(BaseModel):
    """Última lectura real por estación SIATA (no agregada por comuna).

    Cruza `auditoria_estaciones_comunas.csv` (coordenadas + comuna asignada)
    con la última columna no nula de `Solicitud_PM25_DP1763941.csv` (serie
    horaria por estación). No reprocesa el pipeline: solo expone el dato ya
    existente a nivel de estación en vez de nivel de comuna.
    """

    id: str
    nombre: str
    lat: float
    lon: float
    valor_ug_m3: float
    fecha_lectura: str
    comuna_asignada: str


class IntegracionPM25Arboles(BaseModel):
    """Fila de integracion_v2_pm25_arboles_medellin.csv (comuna x periodo cuatrimestral).

    Nota: la columna original 'año' se expone como 'anio' (ASCII) para evitar
    ambigüedades de encoding en JSON/URLs; el renombrado ocurre explícitamente
    en app.services.data_loader, no de forma implícita en este modelo.
    """

    anio: int
    cuatrimestre: str
    periodo: str
    comuna: str
    num_estaciones: int
    codigos_estacion: str
    estaciones_nombres: str
    pm25_promedio_ug_m3: float
    pm25_mediana_ug_m3: float
    pm25_maximo_ug_m3: float
    pm25_p95_ug_m3: float
    horas_validas_total: int
    categoria_oms: str
    cantidad_arboles_totales: int
    cantidad_arboles_mitigadores_pm25: int
    ratio_mitigadores_pct: float
    especies_mitigadoras_presentes: str


class RelacionComunaAnual(BaseModel):
    """Fila de relaciones_v2_bloque2.csv (comuna x año, insumo del recomendador)."""

    anio: int
    comuna: str
    pm25_promedio_anual: float
    pm25_maximo_anual: float
    pm25_p95_anual: float
    arb_totales: int
    arb_mitigadores: int
    ratio_mitigadores: float
    rank_pm25: float
    rank_deficit: float
    score_vulnerabilidad: float
    ranking_vulnerabilidad: int
    deficit_pct_mitigadores: float
    arboles_mitigadores_adicionales: int
    prioridad_intervencion: str
