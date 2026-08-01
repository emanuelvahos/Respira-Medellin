# Resumen Ejecutivo — Visualización de Datos: Arborización Urbana para Mitigación de PM2.5 (Medellín)

## 1. Propósito del proyecto

Proyecto analítico (aparentemente académico, con enfoque institucional simulando a la Secretaría de Medio Ambiente de Medellín) que integra datos de calidad del aire, inventario arbóreo y zonas verdes para **priorizar comunas y zonas específicas donde sembrar árboles mitigadores de PM2.5**, y presenta los resultados en un dashboard interactivo en Streamlit.

## 2. Fuentes de datos

| Fuente | Contenido | Formato |
|---|---|---|
| SIATA (`base_datos_siata`) | Series históricas de PM2.5 por estación + metadatos de estaciones | CSV |
| Inventario arbóreo (`base_datos_arboles`) | 19 archivos oficiales por comuna con censo de árboles, más ficha de especies mitigadoras de PM2.5 | Excel |
| Comunas (`base_datos_comunas`) | Límites catastrales oficiales de las comunas de Medellín (EPSG:9377) | GeoJSON |
| Zonas verdes | Inventario de zonas verdes con tipo de cobertura y tipología (pública/privada) | GeoJSON |
| Documentación técnica | ETL de árboles que reducen PM2.5, Plan Distrital de Silvicultura Urbana | PDF |

## 3. Pipeline analítico

**Bloque 1 — Integración (`scripts/bloque_1/integracion_v2_pm25_arboles_medellin.py`)**
- Reproyecta los polígonos de comuna a WGS84 y asigna cada estación SIATA a su comuna mediante **spatial join** (en vez de mapeo manual, corrección explícita de una v1 propensa a error).
- Reconstruye el inventario arbóreo consolidando los 19 archivos por comuna.
- Genera: `integracion_v2_pm25_arboles_medellin.csv` (dataset integrado, ~97 filas: comuna × año), `relaciones_v2_bloque2.csv`, `auditoria_estaciones_comunas.csv` (trazabilidad del join).

**Bloque 2 — Recomendador de siembra (`scripts/bloque_2/bloque2_recomendador_siembra.py`)**
- Filtra zonas verdes viables (cobertura Grama/Tierra, excluye zonas privadas salvo excepción).
- Calcula capacidad de siembra por zona (`área_útil / separación_mínima²`), respetando distancia de plantación por especie.
- Prioriza comunas con un **modelo multicriterio ponderado (AHP simplificado, Saaty 1980)**:
  `score = 0.45·PM2.5 + 0.35·déficit_mitigadores + 0.20·área_disponible`.
- Asigna especie recomendada por zona según rango altitudinal (1.400–1.800 msnm), suelo y uso.
- Genera: `recomendacion_siembra_por_zona.csv` (~1.649 filas), `resumen_recomendacion_por_comuna.csv`, `zonas_priorizadas_siembra.geojson`.

**Fichas de especies** (`scripts/caracteristicas_especies/`): 5 fichas botánicas (ej. *Bauhinia picta*, *Calliandra haematocephala*) generadas/automatizadas con script propio.

**Dashboard (`dashboard/app.py`)**: app Streamlit ("Ecodata Lab - Medellín") que carga el dataset integrado y los GeoJSON de comunas/zonas verdes, y produce indicadores de PM2.5, cobertura arbórea, mapas coropléticos (`generar_mapa_coropletico.py`, `mapa_coropletico_pm25*.py`) y visualización de comunas priorizadas con Plotly/Folium.

## 4. Stack tecnológico

Python · pandas · geopandas · shapely · numpy · Streamlit · Plotly · Folium/streamlit-folium · matplotlib. El `requirements.txt` está congelado desde un entorno conda (rutas absolutas `file:///home/task_.../work`), **no es portable directamente** con `pip install -r requirements.txt` fuera de ese entorno — habría que regenerarlo con `pip freeze` limpio o usar solo la lista de "dependencias principales" del README.

## 5. Estado del repositorio

- Historial de commits poco descriptivo ("Add files via upload", "n/a"), típico de subida manual vía interfaz web de GitHub, sin flujo de PRs/ramas visible.
- No hay tests automatizados ni CI configurado.
- Rutas en los scripts son relativas y frágiles (`../../bases_de_datos/...`) — **dependen de mantener exactamente la estructura de carpetas documentada en el README**, que difiere ligeramente de la estructura real observada en el repo clonado (p. ej. README describe `data/raw` y `data/clean`, pero el repo tiene `base_datos_arboles/`, `base_datos_comunas/`, `base_datos_siata/` en la raíz y los scripts en `scripts/bloque_1`, `scripts/bloque_2`).
- Incluye una presentación (`presentacion/presentacion.pptx`) y salidas intermedias versionadas (CSV/GeoJSON/PNG de mapas), lo que sugiere que el repo mezcla código, datos y entregables — común en proyectos académicos pero no ideal para producción.

## 6. Valor y hallazgos clave

- El proyecto no solo describe el problema (correlación PM2.5–cobertura arbórea) sino que produce una **recomendación accionable**: qué especie sembrar, dónde y cuántos individuos caben, priorizado por salud pública, déficit de mitigación y viabilidad de terreno.
- La metodología (spatial join + AHP simplificado) es razonable y está bien documentada en los docstrings de los scripts, lo cual facilita auditar y replicar el análisis.

## 7. Riesgos / recomendaciones

1. **Portabilidad**: regenerar `requirements.txt` sin rutas de conda para que sea instalable en cualquier entorno.
2. **Consistencia de rutas**: alinear la estructura real de carpetas con la documentada en el README, o parametrizar rutas vía variables de entorno/config en lugar de rutas relativas hardcodeadas.
3. **Reproducibilidad**: no versionar salidas generadas (CSV/GeoJSON/PNG) junto al código fuente evitaría confusión sobre cuál es la fuente de verdad; considerar `.gitignore` para artefactos regenerables.
4. **Validación de pesos AHP**: los pesos del modelo de priorización (0.45/0.35/0.20) están fijados por defecto sin evidencia de sensibilidad o validación con la Secretaría — vale la pena documentar el proceso de calibración si se usa para decisiones reales.
