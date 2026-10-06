# Gobernanza y calidad de datos

Panel en vivo: sección "Calidad y vigencia de los datos" del dashboard (`GET /api/calidad-datos`). Las fechas de corte se leen de los archivos, no se escriben a mano.

## Reglas
1. **Toda cifra visible tiene fuente y fecha de corte.** Si la fuente no publica fecha, se muestra "No publicada" (hoy: zonas verdes).
2. **Estados:** vigente (dentro de su cadencia recomendada), requiere atención (hasta 2x), desactualizado (más de 2x), sin fecha.
3. **Nunca se mezcla medido con estimado sin marcarlo:** PM2.5 medido, interpolado (IDW) e histórico llevan etiqueta y nivel de confianza en toda la interfaz.
4. **No se fuerzan números sin dato:** comunas sin PM2.5 no reciben puntaje de prioridad.
5. **Correlación no es causalidad:** NDVI y salud respiratoria son evidencia de contexto, no prueba de impacto.
6. **Parámetros de proyección (H4):** solo con cita verificable; si no hay cita, se declara como supuesto.
7. **Cambios de datos por Pull Request** con revisión del diff (filas, comunas afectadas) y chequeos de integridad en verde.

## Estado al 2026-10-06
| Fuente | Estado | Acción |
|---|---|---|
| SAU (Estado) | vigente (corte 2026-10-05) | Confirmar con la Secretaría el estatus oficial de la capa (pendiente, sin contacto posible hoy) |
| PM2.5 estaciones | desactualizado (corte 2026-02-28) | Nueva solicitud a SIATA/Área Metropolitana o descarga SISAIRE (manual) |
| PM2.5 interpolado | desactualizado (depende del anterior) | Recalcular al refrescar estaciones |
| PM2.5 Altavista | desactualizado (estación sin reporte desde 2025-09) | Buscar estación vigente o mantener etiqueta "histórico" |
| Población DANE | vigente (proyección 2024) | Sin refresco antes de 2030 |
| Salud Metrosalud | vigente (consulta 2026-08-12) | Trimestral por script |
| Zonas verdes | sin fecha de corte | Pedir fecha de actualización a GeoMedellín; refrescar cada 6-12 meses |
| NDVI | vigente | Anual, script en GitHub Actions |

## Brechas abiertas
- PM2.5 es el insumo con más peso (45 % del AHP) y el más viejo: es la prioridad de refresco.
- 6 de 21 comunas/corregimientos sin PM2.5 utilizable (4 urbanas sin estación ni vecinas válidas, Palmitas y San Antonio de Prado).
- El SAU no trae DAP, altura ni fecha de siembra: limita la proyección (H4).
