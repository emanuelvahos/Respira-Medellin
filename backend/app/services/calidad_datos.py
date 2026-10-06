"""Panel de calidad y gobernanza de datos (H5).

Cada fuente declara: proveedor, fecha de corte REAL (leída de los archivos,
no escrita a mano, salvo cuando la fuente no la publica), antigüedad frente a
su cadencia recomendada, confianza, cobertura y limitaciones. Además se corren
chequeos de integridad entre datasets. Ver docs/GOBERNANZA_DATOS.md.
"""

from __future__ import annotations

import json
from datetime import date, datetime

import pandas as pd

from app.core.config import get_settings
from app.models.calidad_datos import CalidadDatos, ChequeoIntegridad, FuenteCalidad
from app.services.arboles_detalle import detalle_comunas
from app.services.data_loader import (
    load_ahp_v2_comunas,
    load_arboles_sau_balance,
    load_poblacion_por_comuna,
    load_salud_respiratoria_resumen,
)


def _estado(antig: int | None, cadencia: int) -> str:
    if antig is None:
        return "sin_fecha"
    if antig <= cadencia:
        return "vigente"
    return "atencion" if antig <= 2 * cadencia else "desactualizado"


def _dias(f: str | None, hoy: date) -> int | None:
    if not f:
        return None
    return max(0, (hoy - date.fromisoformat(f[:10])).days)


def _fuente(hoy: date, **k) -> FuenteCalidad:
    antig = _dias(k.get("fecha_corte"), hoy)
    return FuenteCalidad(antiguedad_dias=antig, estado=_estado(antig, k["cadencia_recomendada_dias"]), **k)


def calcular(hoy: date | None = None) -> CalidadDatos:
    hoy = hoy or date.today()
    s = get_settings()
    bal = load_arboles_sau_balance()
    pob = load_poblacion_por_comuna()
    salud = load_salud_respiratoria_resumen()
    v2 = load_ahp_v2_comunas()
    det = detalle_comunas()

    pm = pd.read_csv(s.data_solicitud_pm25_estaciones, usecols=["Fecha"], parse_dates=["Fecha"])
    pm_fin = pm["Fecha"].max().date().isoformat()
    ndvi_meta = json.loads(s.data_ndvi_meta.read_text(encoding="utf-8"))
    alta = pd.read_csv(s.data_ahp_v2_sau_por_comuna.parent / "pm25_historico_altavista.csv")
    alta_fin = str(alta["fecha_ultimo_dato_real"].max())
    # datos mensuales/anuales de salud: último año con registros
    anios = {a for c in salud.comunas for a in c.por_anio}
    salud_corte = salud.fuente.fecha_consulta
    con_pm = [c for c in v2 if c.score_v2_15 is not None]
    sin_pm = [c.comuna for c in v2 if c.score_v2_15 is None]
    anio_pob = max(p.anio for p in pob)

    fuentes = [
        _fuente(
            hoy, id="sau", nombre="Sistema de Árbol Urbano (SAU), capa Estado", proveedor="Alcaldía de Medellín (ArcGIS)",
            usada_en="Conteo de árboles, déficit de especies mitigadoras, AHP v2",
            fecha_corte=bal.fecha_actualizacion_max_fuente, cadencia_recomendada_dias=180, confianza="alta",
            registros=bal.totales.vivos, cobertura="Medellín (21 comunas y corregimientos); un registro por individuo",
            actualizacion="Script (fetch_sau_arboles.py), trimestral con PR de revisión",
            limitaciones=[
                "No hay confirmación institucional de que la capa Estado sea la versión oficial vigente.",
                "Sin DAP ni altura por individuo; la fecha de ingreso al inventario no es la fecha de siembra.",
                f"{bal.totales.talados + bal.totales.desaparecidos + bal.totales.muertos:,} registros no vivos (talados, desaparecidos, muertos) quedan fuera del conteo.".replace(",", "."),
            ],
        ),
        _fuente(
            hoy, id="pm25_estaciones", nombre="PM2.5 horario de estaciones SIATA/SISAIRE", proveedor="SIATA / Área Metropolitana (solicitud DP1763941)",
            usada_en="PM2.5 promedio por comuna y criterio de prioridad (45 % del AHP)",
            fecha_corte=pm_fin, cadencia_recomendada_dias=90, confianza="alta",
            registros=int(len(pm)), cobertura=f"{len(con_pm)} de {len(v2)} comunas con algún dato de PM2.5",
            actualizacion="Manual: archivo entregado por solicitud; requiere nueva solicitud o descarga de SISAIRE",
            limitaciones=[
                "El archivo llega hasta la fecha de corte; la vigencia depende de repetir la solicitud.",
                "Estaciones con series cortas o cerradas (p. ej. MED-UNNV hasta 2020, MED-LAYE hasta 2024).",
            ],
        ),
        _fuente(
            hoy, id="pm25_interpolado", nombre="PM2.5 interpolado (IDW) para comunas sin estación", proveedor="Cálculo propio sobre estaciones reales",
            usada_en="Comunas sin estación propia en el AHP", fecha_corte=pm_fin, cadencia_recomendada_dias=90, confianza="media",
            registros=None, cobertura="Comunas sin estación; 4 estaciones más cercanas, peso 1/d²",
            actualizacion="Script propio sobre el archivo de estaciones",
            limitaciones=["Es una estimación, no una medición; se marca como 'interpolado' en toda la interfaz."],
        ),
        _fuente(
            hoy, id="pm25_altavista", nombre="PM2.5 histórico Altavista (MED-ALTA2)", proveedor="Corantioquia vía SISAIRE/IDEAM",
            usada_en="Único dato disponible para el corregimiento de Altavista", fecha_corte=alta_fin, cadencia_recomendada_dias=90, confianza="baja",
            registros=None, cobertura="1 corregimiento", actualizacion="Manual (descarga SISAIRE)",
            limitaciones=["La estación dejó de reportar: dato real pero no vigente."],
        ),
        _fuente(
            hoy, id="poblacion", nombre="Población por comuna", proveedor="DANE, proyecciones",
            usada_en="Árboles por 1.000 habitantes, tasas de salud", fecha_corte=f"{anio_pob}-12-31", cadencia_recomendada_dias=730,
            confianza="alta", registros=len(pob), cobertura="21 comunas y corregimientos",
            actualizacion="Manual; proyección fija hasta 2030",
            limitaciones=["Es una proyección, no un censo; se usa el año más reciente cargado."],
        ),
        _fuente(
            hoy, id="salud", nombre="Perfil de morbilidad ESE Metrosalud (CIE-10 J00-J99)", proveedor="datos.gov.co / Metrosalud",
            usada_en="Contexto de salud respiratoria por comuna", fecha_corte=salud_corte, cadencia_recomendada_dias=90, confianza="media",
            registros=sum(c.total_diagnosticos_respiratorios for c in salud.comunas),
            cobertura=f"Años {min(anios)}-{max(anios)} (el último puede estar incompleto)",
            actualizacion="Script (fetch_salud_respiratoria.py)",
            limitaciones=["Solo la red pública Metrosalud (régimen subsidiado): refleja a la población atendida, no la morbilidad total.", "No prueba relación causal con PM2.5."],
        ),
        _fuente(
            hoy, id="zonas_verdes", nombre="Inventario de zonas verdes (GeoMedellín)", proveedor="Alcaldía de Medellín",
            usada_en="Zonas candidatas a siembra y área apta (20 % del AHP)", fecha_corte=None, cadencia_recomendada_dias=365,
            confianza="media", registros=None, cobertura="Medellín; polígonos con filtro de viabilidad propio",
            actualizacion="Manual cada 6-12 meses",
            limitaciones=["El archivo descargado no trae fecha de actualización verificable.", "La viabilidad de siembra es un filtro propio, no una validación de campo."],
        ),
        _fuente(
            hoy, id="ndvi", nombre="NDVI Sentinel-2 L2A por comuna", proveedor="Copernicus vía Microsoft Planetary Computer",
            usada_en="Evidencia complementaria de cobertura vegetal", fecha_corte=ndvi_meta["periodo"].split("/")[1], cadencia_recomendada_dias=365,
            confianza="media", registros=None, cobertura=f"{ndvi_meta['fechas_utilizadas']} fechas sin nube, {ndvi_meta['resolucion_m']} m",
            actualizacion="Script (calcular_ndvi_comunas.py) en GitHub Actions",
            limitaciones=["Mide verdor, no árboles ni captura de PM2.5; evidencia complementaria, no prueba de impacto."],
        ),
    ]

    sau_det = sum(d.arboles_vivos for d in det)
    chequeos = [
        ChequeoIntegridad(id="21_comunas", descripcion="Todas las comunas y corregimientos presentes", ok=len(det) == 21 and len(v2) == 21, detalle=f"{len(det)} en detalle SAU, {len(v2)} en AHP v2"),
        ChequeoIntegridad(
            id="suma_vivos", descripcion="Suma de árboles por comuna coincide con el total SAU", ok=0 <= bal.totales.vivos - sau_det < 100,
            detalle=f"total {bal.totales.vivos}, suma por comuna {sau_det} (diferencia = árboles sin comuna asignada)",
        ),
        ChequeoIntegridad(
            id="balance_cuadra", descripcion="Vivos + no vivos = individuos únicos", ok=(bal.totales.vivos + bal.totales.talados + bal.totales.desaparecidos + bal.totales.muertos + bal.totales.historicos + bal.totales.otros) == bal.totales.individuos_unicos,
            detalle=f"{bal.totales.individuos_unicos} individuos únicos",
        ),
        ChequeoIntegridad(
            id="pm25_cobertura", descripcion="Comunas con PM2.5 para calcular prioridad", ok=len(sin_pm) <= 6,
            detalle=f"{len(con_pm)} con dato; sin dato: {', '.join(sin_pm) if sin_pm else 'ninguna'}",
        ),
        ChequeoIntegridad(
            id="pm25_vigencia", descripcion="PM2.5 con menos de 6 meses de antigüedad", ok=(_dias(pm_fin, hoy) or 9999) <= 183,
            detalle=f"último dato {pm_fin} ({_dias(pm_fin, hoy)} días)",
        ),
        ChequeoIntegridad(
            id="poblacion_positiva", descripcion="Población válida en todas las comunas", ok=all(p.poblacion and p.poblacion > 0 for p in pob), detalle=f"{len(pob)} comunas, año {anio_pob}",
        ),
    ]
    malos = [f for f in fuentes if f.estado in ("atencion", "desactualizado", "sin_fecha")]
    resumen = (
        f"{len(fuentes) - len(malos)} de {len(fuentes)} fuentes vigentes. "
        + ("Requieren atención: " + "; ".join(f"{f.nombre} ({f.estado.replace('_', ' ')})" for f in malos) + "." if malos else "Todas vigentes.")
    )
    return CalidadDatos(fecha_calculo=datetime.now().isoformat(timespec="seconds"), fuentes=fuentes, chequeos=chequeos, resumen=resumen)
