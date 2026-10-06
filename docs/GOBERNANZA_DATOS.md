<documento nombre="Gobernanza y calidad de datos, EcoData Lab Medellín" version="2.0" fecha="2026-10-06" marco="DAMA-DMBOK2 / DCAM (adaptado a un programa de una persona)">

<resumen>
El panel en vivo ("Calidad y vigencia de los datos", `GET /api/calidad-datos`) ya cubre vigencia, confianza y chequeos de integridad. Este documento añade lo que un panel no puede mostrar: quién responde por cada dato, qué reglas de calidad se miden, cómo se clasifica, de dónde viene cada cifra (linaje), cuánto tiempo se conserva y qué riesgos siguen abiertos.
Hallazgo principal: el insumo más pesado del AHP (PM2.5, 45 %) es el más viejo (corte 2026-02-28) y su refresco es manual. Segundo: zonas verdes no publica fecha de corte. Tercero: no hay confirmación institucional de la capa SAU "Estado".
</resumen>

<alcance>
Gobierno de datos del producto (ingesta, transformación, publicación en API y dashboard). No cubre los datos internos de la Alcaldía ni de SIATA. Es un programa de una sola persona: los roles existen para que, si el proyecto crece o se entrega a un tercero, la responsabilidad ya esté nombrada.
</alcance>

<roles_y_responsabilidades nota="Hoy una persona ocupa varios roles; la separación es de funciones, no de personas.">
| Rol | Responde por | Quién hoy |
|---|---|---|
| Dueño del dato (Data Owner) | Decide qué fuentes entran, el uso permitido, y acepta riesgos | Emanuel |
| Steward (curador) | Define reglas de calidad, glosario, etiquetas de confianza, revisa PR de datos | Emanuel (apoyado por Claude en la revisión técnica) |
| Custodio (Custodian) | Pipelines, repositorio, despliegue, copias | Claude Code + GitHub Actions + Render/Vercel |
| Proveedores externos | Calidad y vigencia en origen | Alcaldía (SAU, zonas verdes, límites), SIATA/AMVA (PM2.5), DANE, Metrosalud, Copernicus |

RACI de actividades clave (R = ejecuta, A = responde, C = consulta, I = informado):
| Actividad | Owner | Steward | Custodio |
|---|---|---|---|
| Incorporar una fuente nueva | A | R | C |
| Refrescar una fuente (PR con revisión del diff) | A | R | R |
| Cambiar un parámetro de proyección o peso del AHP | A | R | I |
| Publicar una cifra con cita | A | R | I |
| Responder a un error de dato reportado | A | R | R |
</roles_y_responsabilidades>

<clasificacion>
Esquema de 4 niveles (Público / Interno / Confidencial / Restringido).
| Fuente | Nivel | Datos personales | Nota |
|---|---|---|---|
| SAU (árboles) | Público | No | Capa ArcGIS pública de la Alcaldía; coordenadas de árboles, no de personas |
| PM2.5 estaciones | Interno hasta aclarar términos | No | Llegó por solicitud (DP1763941): verificar condiciones de reutilización/redistribución antes de vender |
| Población DANE | Público | No (agregado) | Proyección oficial |
| Salud Metrosalud | Público (agregado por comuna) | No en el producto; la fuente original es de morbilidad | Solo se publican conteos agregados. No exponer registros individuales ni celdas pequeñas |
| Zonas verdes, límites | Público | No | Sin fecha de corte (zonas verdes) |
| NDVI | Público | No | Derivado de Sentinel-2 (Copernicus, uso abierto) |
Regla: ningún dato Restringido entra al repositorio. Si el producto llegara a recibir datos de ciudadanos o de salud individual, aplica la normativa colombiana de protección de datos personales (Ley 1581 de 2012 y decretos reglamentarios) y habría que revisar con un abogado antes de procesarlos.
</clasificacion>

<elementos_criticos_de_dato nota="CDE: se priorizan por peso en el resultado y por riesgo.">
| CDE | Por qué es crítico | Fuente | Dueño de la regla |
|---|---|---|---|
| PM2.5 promedio por comuna | 45 % del AHP y motor del mensaje de impacto | Estaciones SIATA + IDW | Steward |
| Árboles vivos por comuna | Entra al déficit (35 %) y a todas las densidades | SAU Estado | Steward |
| % de especies mitigadoras | Define el déficit | SAU + lista de 5 especies | Steward |
| Área apta para siembra | 20 % del AHP | Zonas verdes + filtro de viabilidad | Steward |
| Población | Denominador de densidades y tasas | DANE | Steward |
</elementos_criticos_de_dato>

<reglas_de_calidad>
| Dimensión | Regla | Elemento | Umbral | Estado hoy | Cómo se mide |
|---|---|---|---|---|---|
| Completitud | Comunas con PM2.5 utilizable | PM2.5 | ≥ 18 de 21 | 15 de 21 (falla) | `pm25_cobertura` en /api/calidad-datos |
| Completitud | Árboles vivos sin comuna | SAU | < 0,1 % | 2 de 431.908 (cumple) | `suma_vivos` |
| Completitud | Vivos sin fecha de actualización | SAU | informar | ~178.000 sin fecha (informado, sin medir en el panel) | Pendiente añadir |
| Completitud | Vivos sin estado fitosanitario | SAU | informar | ~7.300 | Pendiente añadir |
| Oportunidad | Antigüedad PM2.5 | PM2.5 | ≤ 90 días | 219 días (falla) | `pm25_vigencia` (umbral actual 183 días; bajarlo a 90 para alinear) |
| Oportunidad | Antigüedad SAU | SAU | ≤ 180 días | 0 días (cumple) | estado en panel |
| Consistencia | Suma por comuna = total SAU | SAU | diferencia < 100 | 2 (cumple) | `suma_vivos` |
| Consistencia | Vivos + no vivos = únicos | SAU | exacto | cumple | `balance_cuadra` |
| Consistencia | Capa Estado vs Contrato | SAU | 0 discrepancias de estado | 0 en 465.411 comunes (cumple) | sau_comparacion_capas.json |
| Validez | Población > 0 | Población | todas | cumple | `poblacion_positiva` |
| Validez | NDVI entre -1 y 1 | NDVI | todas | cumple | test de la API |
| Unicidad | Un registro por árbol | SAU | 0 duplicados en vivos | cumple (dedup por código) | script de descarga |
| Exactitud | Contraste con fuente externa | Árboles | ±5 % frente a dato oficial | sin validar (no hay cifra oficial citable) | Pendiente: confirmar con la Secretaría |
Cada regla falla de forma visible (panel) y por CI cuando es determinista (tests de la API).
</reglas_de_calidad>

<linaje cifras_clave="de dónde sale cada número visible">
- Árboles vivos (tarjeta, tabla por comuna): SAU Contrato/MapServer/3 → `fetch_sau_arboles.py` (dedup, criterio de vivo) → `sau_arboles_urbanos.csv` → `/api/arboles/*`.
- Puntaje y posición AHP v2: SAU + PM2.5 (medido/interpolado/histórico) + zonas verdes → `calcular_ahp_v2_sau.py` → `ahp_v2_sau_por_comuna.csv` → `/api/siembra/ahp-v2`. El AHP v1 sigue intacto como referencia.
- Explicación "por qué esta prioridad": contribución = peso × valor normalizado, calculado en `arboles_detalle.py` a partir de las columnas v2 (no se recalcula aparte).
- NDVI: Sentinel-2 L2A → `calcular_ndvi_comunas.py` (Actions) → `ndvi_por_comuna.csv` + `ndvi_meta.json`.
- Panel de calidad: lee fechas de los propios archivos y de `sau_arboles_balance.json`.
Brecha: no hay una tabla de linaje máquina-legible; hoy vive en este documento y en `docs/*`.
</linaje>

<retencion_y_ciclo_de_vida>
| Dato | Conservación | Disposición |
|---|---|---|
| CSV/JSON de datos publicados | Versionados en Git (historial = auditoría) | Se reemplazan por PR; el historial queda |
| Archivo PM2.5 horario (8 MB) | Indefinida mientras sea la base del AHP | Reemplazar al recibir el archivo nuevo |
| Salidas intermedias de Actions (ramas de resultado) | Hasta fusionar el PR | Borrar la rama al cerrar |
Para plazos legales de conservación de datos de terceros, confirmar con las condiciones de cada proveedor; no se inventan periodos estatutarios.
</retencion_y_ciclo_de_vida>

<reglas_de_publicacion>
1. Toda cifra visible lleva fuente y fecha de corte; si no hay fecha se dice "No publicada".
2. Medido, interpolado e histórico se etiquetan siempre; nunca se promedian entre sí sin etiqueta.
3. Comunas sin PM2.5 no reciben puntaje; no se imputa.
4. Correlación no es causalidad: NDVI y salud son contexto, no prueba de impacto.
5. Parámetros de proyección: solo con cita verificada; el resto se rotula "supuesto" (ver registro en `H4_HALLAZGOS_PROYECCION.md`).
6. Cambios de datos por Pull Request con revisión del diff y chequeos en verde.
7. Un dato de la lista de "brechas" no se usa en materiales comerciales sin declarar la limitación.
</reglas_de_publicacion>

<registro_de_riesgos>
| # | Riesgo | Prob. | Impacto | Puntaje | Tratamiento | Control | Dueño |
|---|---|---|---|---|---|---|---|
| R1 | PM2.5 desactualizado sesga el 45 % del AHP | 5 | 4 | 20 | Mitigar | Nueva solicitud SIATA/SISAIRE; alerta en panel | Owner |
| R2 | Capa SAU Estado no es la oficial vigente | 3 | 5 | 15 | Aceptar con declaración / confirmar | Disclaimer visible; contrastar con cifra oficial cuando se pueda | Owner |
| R3 | Condiciones de reutilización del PM2.5 (archivo por solicitud) impiden venderlo | 3 | 5 | 15 | Verificar | Revisar la respuesta de la solicitud DP1763941 antes de comercializar | Owner |
| R4 | Zonas verdes sin fecha ni validación de campo (viabilidad de siembra) | 3 | 3 | 9 | Mitigar | Pedir fecha a GeoMedellín; declarar "viabilidad estimada" | Steward |
| R5 | Parámetros de proyección citados mal | 3 | 4 | 12 | Mitigar | Confirmar contra PDF original antes de publicar | Steward |
| R6 | 6 de 21 comunas sin PM2.5: se interpreta como "sin problema" | 3 | 3 | 9 | Mitigar | Mensaje explícito "sin dato", no "bajo" | Steward |
| R7 | Dependencia de servicios gratuitos (Render, ArcGIS, Planetary Computer) | 3 | 3 | 9 | Aceptar | Datos versionados en el repo; scripts reejecutables | Custodio |
| R8 | Salud: sesgo de la red pública leído como incidencia real | 3 | 3 | 9 | Mitigar | `metodologia` viaja con el dato (ya implementado) | Steward |
</registro_de_riesgos>

<madurez nota="Escala 0-5 (DCAM/CMMI). Autoevaluación; revisar con alguien externo antes de usarla comercialmente.">
| Área DAMA | Hoy | Meta a 3 meses | Brecha principal |
|---|---|---|---|
| Gobierno (políticas, roles) | 2 | 3 | Roles nombrados pero sin proceso de excepciones |
| Calidad de datos | 3 | 4 | Reglas medidas en panel; faltan completitud de fecha/estado y exactitud externa |
| Metadatos / glosario | 2 | 3 | Sin glosario único (términos: vivo, mitigadora, déficit) ni catálogo máquina-legible |
| Linaje | 2 | 3 | Solo documental |
| Clasificación y acceso | 2 | 3 | Verificar términos del PM2.5 |
| Retención / ciclo de vida | 1 | 2 | Sin política explícita de reemplazo |
| Maestros y referencia | 2 | 3 | Llave de comuna por nombre normalizado (no por código DANE) |
</madurez>

<kpis>
Cobertura de dueño y steward: 100 %. Fuentes vigentes: 4 de 8 (meta ≥ 7). Chequeos de integridad en verde: 5 de 6 (meta 6 de 6). Fuentes con fecha de corte publicada: 7 de 8. Riesgos con puntaje ≥ 15 abiertos: 3.
</kpis>

<acciones_priorizadas>
1. (Manual) Nueva solicitud/descarga de PM2.5 y revisar condiciones de reutilización de la respuesta DP1763941.
2. Bajar el umbral de `pm25_vigencia` a 90 días y añadir al panel los chequeos de completitud de fecha de actualización y estado fitosanitario del SAU.
3. Crear un glosario único (vivo, mitigadora, déficit, confianza) y enlazarlo desde el panel.
4. Migrar el cruce de comunas de nombre a código DANE.
5. Pedir fecha de actualización de zonas verdes a GeoMedellín.
6. Contrastar el total de árboles con una cifra oficial citable cuando exista.
</acciones_priorizadas>

<avisos>
Documento de apoyo a la gestión, no asesoría legal. La referencia a la Ley 1581 de 2012 y a las condiciones de reutilización de datos debe confirmarla un abogado antes de comercializar.
</avisos>

</documento>
