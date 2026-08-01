# Guía de migración: de Streamlit a la arquitectura EcoData Lab

> Este documento explica **por qué** y **cómo** se pasó del prototipo analítico en
> Streamlit (`Visualizacion-de-datos/dashboard/`) a la arquitectura actual —
> un frontend Next.js inmersivo (`ecodata-lab-frontend/`) sobre una API FastAPI
> (`backend/`) — sin tener que leer el historial de conversación que la produjo.

## 1. Por qué se migró

El prototipo original (`dashboard/app.py`) es una app Streamlit funcional: carga
el CSV integrado y los GeoJSON de comunas/zonas verdes, y presenta métricas,
gráficas Plotly y un mapa coroplético con Folium. Cumple su propósito como
herramienta de análisis exploratorio, pero tiene limitaciones estructurales
para el objetivo de este proyecto (mostrarle a la Secretaría de Medio Ambiente
una experiencia que comunique la escala del problema y de la intervención
propuesta):

- **Sin mapas 3D reales.** Folium renderiza Leaflet en un `<iframe>` estático
  embebido vía `streamlit-folium`; no hay extrusión de geometría por score,
  ni control de cámara programático, ni superposición de escenas 3D (árboles,
  partículas). Streamlit no expone un canvas WebGL propio para eso.
- **Sin scroll-telling.** La narrativa de la landing (secciones que se activan
  al hacer scroll, sincronizadas con la cámara del mapa) requiere control fino
  del layout y de eventos de scroll que el modelo de re-render de Streamlit
  (todo el script se re-ejecuta en cada interacción) no ofrece de forma nativa
  y fluida.
- **Interactividad limitada del lado cliente.** Un comparador de escenarios AHP
  con sliders que recalculan en vivo, accesibles por teclado y con anuncios de
  lector de pantalla, es directo en React/Radix; en Streamlit implica
  reruns completos del script por cada cambio de slider, con latencia visible.
- **Sin separación de capas.** Streamlit acopla lectura de datos, cálculo y
  presentación en el mismo script Python ejecutado en el servidor de la app.
  Eso hace difícil exponer los mismos datos a un cliente distinto (por ejemplo,
  si más adelante se quisiera un mapa embebido en otro sitio, o una app móvil).

La decisión fue **separar** en una API (FastAPI) que expone los datos ya
calculados, y un frontend (Next.js) que consume esa API y construye la
experiencia visual/interactiva. Esto no fue una reescritura del análisis —
fue construir una capa de presentación nueva sobre el mismo trabajo analítico.

## 2. Mapeo: qué reemplaza a qué

| Streamlit (`Visualizacion-de-datos/dashboard/`) | Equivalente nuevo | Notas |
|---|---|---|
| `app.py` (app completa: sidebar, métricas, tabs) | `ecodata-lab-frontend/src/app/dashboard/page.tsx` + `src/components/dashboard/*` | Los "filtros" del sidebar (`st.sidebar.selectbox` de año/comuna) se volvieron controles embebidos en cada gráfica/tabla (`ComunasTable`, `Pm25BarChart`), no un panel global — cada componente pide solo el dato que necesita vía React Query. |
| `st.plotly_chart(fig_top5, ...)` (top 5 comunas) | `src/components/dashboard/RankingScoreChart.tsx` (Recharts) | Mismo dato (`score_multicriteria`/`ranking_prioridad`), gráfica reimplementada en Recharts para integrarse con el sistema de diseño (tokens de color, dark mode). |
| Métricas PM2.5 anuales (`df_pm25_anual`, gráficas de líneas) | `src/components/dashboard/Pm25TrendChart.tsx`, `Pm25BarChart.tsx` | El cálculo de promedio anual por comuna se hace en el backend (`/api/pm25`), no en el cliente. |
| `folium.Map` + `folium.GeoJson` (mapa coroplético de comunas coloreadas por PM2.5) | `ecodata-lab-frontend/src/components/map/MapCanvas.tsx` (deck.gl `GeoJsonLayer` sobre Mapbox GL) | La coloración pasó de PM2.5 crudo a **score AHP** (color + altura de extrusión), alineado con el objetivo de priorización, no solo de diagnóstico. |
| `folium.CircleMarker` por estación SIATA | Capa de partículas animadas (`pm25Layer.ts`, deck.gl) | Antes eran marcadores estáticos con popup; ahora la densidad/velocidad de partícula es proporcional al dato real de la estación — mismo dato (`/api/pm25/estaciones`), presentación distinta. |
| `generar_mapa_coropletico.py`, `mapa_coropletico_pm25*.py` (scripts que generan PNGs estáticos del mapa para el dashboard/README) | No tienen equivalente 1:1 — el mapa ya no se pre-renderiza a imagen, se sirve interactivo en `/mapa`. Los PNG generados (`mapa_coropletico_*.png`) quedan como artefactos históricos en `Visualizacion-de-datos/dashboard/`. |
| Inventario arbóreo (censo por comuna, usado en el dashboard para "árboles totales") | `src/components/trees/TreeInstances.tsx` (instancias 3D en `/mapa`) + `KpiCards.tsx` (`/dashboard`) | El mapa 3D **no** renderiza el censo completo (sería miles de instancias por comuna); usa una muestra representativa dimensionada por la cantidad real (ver `docs/ESTADO_PROYECTO.md` → limitaciones conocidas). El dashboard sí muestra el número real agregado. |
| `logo_alcaldia.png`, `style.css` (branding Streamlit) | `src/config/site.ts`, `src/app/globals.css` (tokens de diseño), `src/app/icon.svg` | Branding rehecho como sistema de diseño (Fase 0), no como CSS ad-hoc sobre los widgets de Streamlit. |

No existe una migración directa de `st.sidebar` como componente — su
responsabilidad se repartió entre `Header` (navegación global) y controles
locales por sección (`MapLayerToggles`, filtros de `ComunasTable`).

## 3. La lógica de negocio del pipeline no se reescribió

Punto central de la arquitectura: **el backend FastAPI es una capa de
exposición, no de reimplementación.** Bloque 1 (integración PM2.5 × árboles,
spatial join) y Bloque 2 (recomendador de siembra, modelo AHP) siguen siendo
los scripts Python originales en `Visualizacion-de-datos/scripts/`. El backend:

- Lee los CSV/GeoJSON que esos scripts ya generaron (`app/services/data_loader.py`),
- los tipa con Pydantic v2,
- reproyecta geometrías de EPSG:9377 a EPSG:4326 cuando hace falta (ver
  `backend/README.md` → "Reproyección de geometrías"),
- y expone todo como JSON/GeoJSON.

La única lógica que el backend **sí** recalcula es el ranking AHP con pesos
custom (`/api/siembra/ranking-comunas`, para el comparador de escenarios de la
Fase 4) — y lo hace reproduciendo exactamente la fórmula de
`bloque2_recomendador_siembra.py` (`app/services/ahp.py`), no una versión
nueva. Con los pesos por defecto (0.45/0.35/0.20) el resultado reproduce
bit a bit el `ranking_prioridad` del CSV original (confirmado en el checklist
de regresión de la Fase 6, ver `docs/ESTADO_PROYECTO.md`).

Si el pipeline de ciencia de datos cambia (nuevos datasets, nueva fórmula),
el cambio se hace en `Visualizacion-de-datos/scripts/`, se regeneran los
CSV/GeoJSON, y el backend los sirve sin tocar código — esa es la garantía que
esta separación de capas buscaba preservar.

## 4. Decisiones de arquitectura clave

**deck.gl sobre Cesium.** Se necesitaba extrusión de polígonos por score y
capas de partículas animadas sobre un basemap Mapbox con estilo consistente
con el sistema de diseño. deck.gl se integra directamente como capas sobre
Mapbox GL JS (mismo sistema de coordenadas, mismo control de cámara), mientras
que Cesium trae su propio globo 3D y motor de render — más pesado y pensado
para escenas georreferenciadas de escala planetaria, que no es el caso de uso
(una ciudad, comunas administrativas, sin necesidad de terreno/elevación real
del globo).

**Recharts sobre Visx.** Recharts da componentes de gráfica listos
(`BarChart`, `LineChart`) con buena integración de theming vía props/CSS
variables, suficiente para las necesidades del dashboard (barras, líneas,
tooltips, ejes). Visx es más una caja de herramientas de bajo nivel (primitivas
D3 envueltas en componentes React) pensada para visualizaciones custom más
elaboradas — más control, pero más tiempo de construcción para gráficas
estándar como las que necesita este dashboard.

**Ambigüedad de normalización AHP.** El script original
(`bloque2_recomendador_siembra.py`) normaliza (Min-Max) sobre la población de
comunas con datos PM2.5 de bloque_1, pero `resumen_recomendacion_por_comuna.csv`
solo persiste comunas que además tienen zonas de siembra — un conjunto
parcialmente distinto. Reconstruir el ranking asumiendo que la población de
normalización es la del CSV final (en vez de la población real usada por el
script) invierte el orden en las posiciones 3-4 (confirmado empíricamente).
El endpoint `/api/siembra/ranking-comunas` reconstruye la población correcta
desde `integracion_v2_pm25_arboles_medellin.csv` — ver el docstring de
`backend/app/services/ahp.py` para el detalle completo con la evidencia.

**PM2.5 por estación vs. por comuna.** El dataset integrado de bloque_1 agrega
PM2.5 por comuna (una estación puede no existir en cada comuna; el spatial
join asigna la estación más cercana). Para la capa de partículas animadas del
mapa, agregar por comuna habría dado el mismo valor a toda una comuna,
perdiendo la variación espacial real entre estaciones. Por eso
`/api/pm25/estaciones` expone la última lectura real **por estación SIATA**
(no agregada), y es esa la fuente de la capa de partículas — la densidad y
velocidad de cada nube de partículas corresponde a una estación real, no a un
promedio de comuna.

## 5. Qué no cambió

- Las fuentes de datos originales (SIATA, inventario arbóreo, comunas, zonas
  verdes) no se tocaron ni se reprocesaron con lógica nueva.
- El modelo AHP (pesos, fórmula) es el mismo; solo se hizo parametrizable
  (Fase 4) para permitir análisis de sensibilidad, un riesgo que el propio
  `RESUMEN_EJECUTIVO.md` del repo de datos señalaba como pendiente.
- Los scripts de `Visualizacion-de-datos/dashboard/` (incluyendo `app.py`) no
  se eliminaron — quedan como referencia histórica del prototipo, pero ya no
  son el frontend activo del proyecto.
