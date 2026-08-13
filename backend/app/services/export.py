"""Genera PDF/Excel del ranking AHP de comunas ya calculado por `app.services.ahp`.

Este módulo NO recalcula el ranking — recibe la lista de `RankingComunaItem`
ya producida por `calcular_ranking_comunas` (misma función que usa
`GET /api/siembra/ranking-comunas`) y solo la serializa a un formato de
archivo. Así el endpoint de exportación nunca puede desincronizarse del
endpoint normal: son la misma lógica de negocio, dos salidas distintas.

Este reporte es específicamente del ranking de priorización de siembra — no
mezcla datos de salud respiratoria (Metrosalud) ni del inventario del SAU,
siguiendo el mismo criterio de no combinar fuentes sin una decisión aparte.

PDF con `reportlab` (no `weasyprint`): reportlab es Python puro, sin
dependencias de sistema (Pango/Cairo/GDK) que romperían el deploy en Render
documentado en este README (build nativo, sin Dockerfile).
"""

import io
from datetime import date

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.siembra import RankingComunaItem

PesosAhp = dict[str, float]


def _fecha_generacion() -> str:
    return date.today().isoformat()


def nombre_archivo(formato: str) -> str:
    extension = "pdf" if formato == "pdf" else "xlsx"
    return f"ranking-siembra-medellin-{_fecha_generacion()}.{extension}"


def _filas_tabla(items: list[RankingComunaItem]) -> list[dict]:
    return [
        {
            "ranking": it.ranking_prioridad,
            "comuna": it.comuna,
            "score_total": round(it.score_total, 4),
            "pm25_promedio_ug_m3": it.pm25_promedio,
            "deficit_pct": it.deficit_pct,
            "area_total_disponible_ha": it.area_total_disponible_ha,
            "especie_principal": it.especie_principal,
            "arboles_a_plantar_total": it.arboles_a_plantar_total,
        }
        for it in items
    ]


def build_ranking_excel(items: list[RankingComunaItem], pesos: PesosAhp) -> bytes:
    """Hoja "Ranking" (tabla completa) + hoja "Metadata" (pesos usados y fecha)."""
    df_ranking = pd.DataFrame(_filas_tabla(items))
    df_meta = pd.DataFrame(
        [
            {"campo": "peso_pm25", "valor": pesos["peso_pm25"]},
            {"campo": "peso_deficit", "valor": pesos["peso_deficit"]},
            {"campo": "peso_area", "valor": pesos["peso_area"]},
            {"campo": "fecha_generacion", "valor": _fecha_generacion()},
            {"campo": "fuente", "valor": "EcoData Lab Medellín — /api/siembra/ranking-comunas"},
        ]
    )

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df_ranking.to_excel(writer, sheet_name="Ranking", index=False)
        df_meta.to_excel(writer, sheet_name="Metadata", index=False)
    return buffer.getvalue()


def build_ranking_pdf(items: list[RankingComunaItem], pesos: PesosAhp) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.2 * cm,
        rightMargin=1.2 * cm,
    )
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Ranking de comunas priorizadas para siembra", styles["Title"]),
        Paragraph(f"Generado: {_fecha_generacion()} — EcoData Lab Medellín", styles["Normal"]),
        Paragraph(
            f"Pesos AHP usados — PM2.5: {pesos['peso_pm25'] * 100:.0f}% · "
            f"Déficit de mitigadores: {pesos['peso_deficit'] * 100:.0f}% · "
            f"Área disponible: {pesos['peso_area'] * 100:.0f}%",
            styles["Normal"],
        ),
        Spacer(1, 0.6 * cm),
    ]

    header = ["#", "Comuna", "Score", "PM2.5 (µg/m³)", "Déficit %", "Área (ha)", "Especie principal"]
    rows = [header]
    for it in items:
        rows.append(
            [
                str(it.ranking_prioridad),
                it.comuna,
                f"{it.score_total:.3f}",
                f"{it.pm25_promedio:.1f}" if it.pm25_promedio is not None else "s/d",
                f"{it.deficit_pct:.1f}" if it.deficit_pct is not None else "s/d",
                f"{it.area_total_disponible_ha:.1f}",
                it.especie_principal,
            ]
        )

    tabla = Table(rows, repeatRows=1)
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f4d2c")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f0f0")]),
            ]
        )
    )
    story.append(tabla)

    doc.build(story)
    return buffer.getvalue()
