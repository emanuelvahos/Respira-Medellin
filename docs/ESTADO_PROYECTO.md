# Estado del proyecto — EcoData Lab Medellín

> Inventario honesto de qué funciona, qué quedó documentado como limitación, y
> cómo levantar todo desde cero. Escrito al cierre de la Fase 6 (entrega
> final). Ver también `docs/GUIA_MIGRACION.md` para el contexto de por qué la
> arquitectura es la que es. Ver también
> [`docs/ACTUALIZACION_DATOS.md`](./ACTUALIZACION_DATOS.md) para la cadencia
> recomendada de refresco de cada fuente de datos.

### Fase F4: proyección temporal de maduración del plan de siembra (2026-08-21)

Nuevo componente `ProyeccionTemporal` en `/dashboard`: explora cómo crecería
en el tiempo el efecto estimado del plan de siembra recomendado, a medida
que los árboles plantados maduran — **nunca presenta un valor de PM2.5 en
µg/kg**, solo un % (0-100) que multiplica los datos reales ya existentes
(`arboles_cupo_estimado`, eficiencia cualitativa de mitigación).

**Investigación previa** (2 rondas de exploración documentadas en el
historial de la fase, resumidas aquí): la categoría de velocidad de
crecimiento (Lenta/Media/Rápida) de las 5 especies documentadas está
validada con 2 fuentes reales independientes (`fichas_especies.json` y
Vásquez-Bedoya & Arroyave-Maya 2019, Revista EIA). Los AÑOS concretos de
maduración por escenario NO tienen ese mismo respaldo — solo *Retrophyllum
rospigliosii* (Pino Romerón) tiene un ancla numérica real (crecimiento
medido en plantaciones andinas colombianas); las otras 4 especies usan
convención general de arboricultura urbana. Se confirmó explícitamente que
el SAU (339.724 árboles) **no tiene** un campo real de madurez ni de
diámetro por individuo en su capa pública actual — no fue posible anclar
esta curva con datos propios del proyecto, solo con literatura y la
categoría cruzada.

**Qué se construyó**:
- Backend: `GET /api/siembra/proyeccion?anio=&escenario=` (Fase F4) — curva
  logística `factor(t) = 1 / (1 + e^(-k·(t-t_mitad)))` calibrada por
  especie/escenario para que `factor(0)=0.02` y `factor(anio_maduracion)=0.90`.
  Agrega por comuna y ciudad ponderando por `arboles_cupo_estimado` real; en
  las ~146 zonas con propuesta de diversificación de especies (Fase E3), el
  factor se pondera por la proporción real de cada especie en esa zona, no
  un factor genérico por zona. Ver `backend/app/services/maduracion.py` y
  `backend/README.md` ("Curva de maduración del plan de siembra (Fase F4)").
- Frontend: `ProyeccionTemporal.tsx` en `/dashboard` — slider de años (0 al
  máximo del escenario conservador, ~40 años), selector de 3 escenarios
  (optimista/esperado/conservador), gráfica de línea con marcador en el año
  seleccionado, desglose por especie, y **los 6 caveats metodológicos
  siempre visibles** (nunca detrás de un click/hover) — el texto de los
  caveats viene literalmente del campo `caveats` de la respuesta del
  endpoint, una sola fuente de verdad con el backend.
- **No se construyó** una versión animada en el mapa (árboles "creciendo"
  visualmente) — se evaluó y se decidió priorizar la versión de dashboard
  (gráfica 2D determinista) para no reintroducir el mismo tipo de riesgo
  técnico que tuvo `TreeInstances`/three.js (Fase F3): la curva de
  maduración ya es la pieza de mayor incertidumbre metodológica del
  proyecto, no ameritaba sumarle además complejidad de renderizado 3D.

**Caveats que viajan con el dato** (ver el endpoint, nunca solo en esta
documentación): la categoría de crecimiento está validada con 2 fuentes,
los años no; el SAU no tiene madurez/DAP por individuo hoy; solo el Pino
Romerón tiene ancla numérica real; esto modela el efecto marginal del plan,
no el PM2.5 total futuro de la ciudad; la comparación contra el Plan
Distrital de Silvicultura Urbana (i-Tree Eco real) es de plausibilidad, no
de calibración; si se consigue data real de madurez del SAU, debe
reemplazar esta estimación, no complementarla.

### Fase F3: remoción de los árboles 3D ("Respiro Urbano") — decisión consciente de UX, no un bug (2026-08-21)

Se removió por completo la revelación de árboles 3D al seleccionar una comuna
(`TreeInstances.tsx`, construida en la Fase 3) y toda su sincronización de
cámara geo↔three.js (`mapboxThreeSync.ts`). **Decisión de UX confirmada
visualmente por el dueño del proyecto, no un bug sin resolver**: los conos 3D
se sentían confusos y se desplazaban de forma extraña al rotar/arrastrar el
mapa. Esta pieza fue, a lo largo de todo el proyecto, la técnicamente más
frágil (bug de escala de copas sub-píxel, sign-flip de coordenadas norte/sur,
bucle infinito de render por resincronización de `viewState`, blocking de
clicks reales del mapa por el canvas three.js encima de deck.gl — varias
rondas de debugging profundo documentadas en los comentarios del código que
se removió). Ya existía una alternativa que sí funciona bien y fue validada
visualmente: la capa de clusters/puntos reales del SAU
(`arbolesSauLayer.ts`), que ahora es la única representación de árboles
reales en el mapa.

**Qué se eliminó**: `src/components/trees/TreeInstances.tsx`,
`src/lib/map/mapboxThreeSync.ts`, `src/components/map/TreeModeSelector.tsx`,
el estado `treesRevealed`/`treeMode`/`setTreeMode` de `mapStore.ts`, la
lógica de revelación al final del flyTo en `MapCanvas.tsx`, y las funciones
`bboxOfGeometry`/`randomPointsInPolygon` (usadas solo por los árboles 3D;
`scatterInPolygon.ts` se renombró a `pointInPolygon.ts` porque ya no dispersa
nada, solo prueba pertenencia). Se desinstalaron `three`, `@react-three/fiber`,
`@react-three/drei` y `@types/three` — no se usaban en ningún otro lado del
proyecto (confirmado por búsqueda de referencias antes de borrar).

**Qué se mantuvo intacto**: el `flyTo` de cámara al seleccionar una comuna
(zoom a nivel de calle, mismo `COMUNA_FLYTO_ZOOM`/`PITCH`/`BEARING` de
siempre) — sigue siendo una buena experiencia por sí sola, solo se quitó la
aparición de conos 3D al final de la animación. La capa de clusters/puntos
del SAU (toggle "Árboles del SAU" en `MapLayerToggles`) no se tocó y sigue
funcionando exactamente igual; como ya no depende de un modo mutuamente
excluyente con los árboles 3D (`TreeModeSelector` los alternaba), volvió a
ser un checkbox independiente en el panel de Capas, igual que las demás capas.

### Incidente: deploy de Render caído por `ValidationError` de `Settings` → CORREGIDO (2026-08-18)

Los árboles 3D dejaban de mostrarse en ubicaciones reales del SAU y el
tooltip nunca mostraba especie, en producción, pese a funcionar en local.
Diagnóstico con evidencia real de Network (no suposición): `GET
/api/arboles/puntos` y `GET /api/salud/resumen-comuna` devolvían **404** en
`https://ecodata-backend.onrender.com`, mientras `/api/comunas`, `/api/pm25`
y `/api/siembra/resumen-comuna` respondían `200` con normalidad. Causa raíz:
`Settings` (`backend/app/core/config.py`) ganó 3 campos `Path` obligatorios
(`data_sau_arboles_urbanos`, `data_salud_respiratoria_resumen_comuna`,
`data_poblacion_por_comuna`) en integraciones sucesivas (SAU, salud
respiratoria, población), pero **`render.yaml` nunca se actualizó con las
variables de entorno correspondientes** — solo vivían en `.env`/`.env.example`
locales. Render fallaba `Settings()` con `ValidationError` al arrancar
(3 variables faltantes), lo que en la práctica se veía como rutas 404 (el
servicio corría una versión previa a esas 3 integraciones, la última que
había logrado arrancar con éxito), no como un crash visible.

Corrección: se agregaron las 3 variables a `render.yaml` con el mismo patrón
ya usado (rutas relativas `./data/...`, valores idénticos a `.env.example`);
se confirmó que `backend/data/sau_arboles_urbanos.csv`,
`salud_respiratoria_resumen_comuna.json` y `poblacion_por_comuna.csv` están
versionados en git (no ignorados) y se simuló el set exacto de variables de
`render.yaml` localmente (sin `.env`) para confirmar que `app.main` importa
sin `ValidationError` antes de hacer push.

**Decisión de diseño (obligatorias, no opcionales con default)**: estas 3
variables se dejaron como campos `Path` obligatorios en `Settings`, igual
que `data_zonas_priorizadas_siembra`/`data_limite_catastral_comunas` — NO se
les dio un valor por defecto en Python (a diferencia de
`data_scores_ahp_extendido_sin_siembra`/`data_scores_ahp_interpolado_idw`/etc.,
que sí son opcionales porque son fuentes complementarias secundarias de
integraciones de recálculo AHP). SAU, salud respiratoria y población son
datasets core usados en el flujo principal del producto, no enriquecimiento
opcional — la falla fuerte y visible en el arranque (`ValidationError` en
los logs de build) es preferible a un backend que arranca "a medias" sin
avisar. La ausencia del *archivo en disco* (no de la variable) sigue
manejada con 503 controlado vía `_require_file()`, patrón ya establecido
para zonas verdes — esa capa no cambió.

**Lección para futuras integraciones**: antes de dar por cerrada cualquier
integración que agregue un campo `Path` obligatorio a `Settings`, diff
`render.yaml` contra `.env.example` explícitamente — ver nota espejo en
`backend/README.md`, sección Deploy.

**Nota (mismo día, después del push)**: tras agregar las variables en
`render.yaml` y en el dashboard de Render, un deploy mostró el mismo
`ValidationError` — resultó ser un log de un intento previo a que Render
terminara de aplicar la configuración nueva, no un segundo bug distinto
(se descartó explícitamente la hipótesis de `ModuleNotFoundError` por
dependencia faltante en `requirements.txt`: el traceback real seguía
siendo la misma `ValidationError` de Pydantic, no un `ImportError`). Un
**Manual Deploy** disparado a mano con la configuración ya vigente resolvió
todo sin cambios de código adicionales. Confirmado en producción real:
`/health`, `/api/arboles/puntos`, `/api/salud/resumen-comuna` y
`/api/comunas/poblacion` responden `200`. Lección: si un log de error en
Render parece inconsistente con la configuración ya verificada en el
dashboard, disparar un Manual Deploy fresco antes de asumir una causa
nueva — Render no siempre re-despliega automáticamente al guardar una
variable de entorno.

### `docs/ACTUALIZACION_DATOS.md` → NUEVO (2026-08-14)

Documento único de referencia sobre cuándo/cómo refrescar cada una de las 5
fuentes de datos del proyecto (pipeline original, zonas verdes, SAU, salud
respiratoria, población). Para SAU y salud respiratoria (que ya tenían
script de descarga propio con throttling) se implementó
`.github/workflows/refresh-data.yml`: cron trimestral que corre ambos
scripts y **abre un Pull Request** con el resultado para revisión humana
— nunca hace merge automático. Zonas verdes y población quedan manuales
(no tienen script, cadencia de meses/años no lo justifica); el pipeline
original queda explícitamente fuera de alcance (recalcularlo invalidaría
`docs/VALIDACION_SENSIBILIDAD_AHP.md` sin aviso).

### `docs/VALIDACION_SENSIBILIDAD_AHP.md` → NUEVO (2026-08-14)

Entregable formal (no técnico) que responde el riesgo señalado en el
proyecto original: "los pesos del AHP están fijados sin evidencia de
sensibilidad". Analiza 5 escenarios de pesos reales (consultados en vivo
contra `/api/siembra/ranking-comunas`), identifica comunas "robustas"
(Guayabal, Belén, Castilla, El Poblado — top 5 en los 5 escenarios) vs.
"sensibles a la ponderación" (La Candelaria, Robledo), calcula correlación
de Spearman por escenario (0.91-0.99, alta similitud) y un punto de quiebre
en ~53% de peso a PM2.5 donde cambia el #1. No recomienda cambiar los pesos
por defecto (siguen en 0.45/0.35/0.20, sin modificar) ni se implementó una
sección nueva de dashboard — se evaluó y se dejó como mejora futura, dado
que el comparador interactivo de `/dashboard` (Fase 4) ya cubre la
exploración libre de escenarios y el documento cubre el entregable formal
que faltaba.

## 1. Qué está 100% funcional

- **Landing (`/`)**: scroll-telling con secciones sincronizadas a la cámara
  del mapa, `prefers-reduced-motion` respetado en toda la animación (GSAP +
  three.js).
- **Mapa 3D (`/mapa`)**: comunas extruidas por score AHP (color + altura),
  zonas de siembra priorizadas, partículas PM2.5 animadas por estación real,
  árboles 3D al seleccionar una comuna (troncos/copas instanciados,
  muestreados — ver limitaciones abajo), panel de detalle de comuna, y un
  selector de comuna por teclado (`ComunaKeyboardSelector`) como alternativa
  no-visual a hacer click sobre el canvas WebGL.
- **Dashboard (`/dashboard`)**: KPIs, PM2.5 por comuna y en el tiempo, tabla
  de comunas ordenable/filtrable, comparador de escenarios AHP con sliders
  operables por teclado (flechas) que anuncian su valor a lectores de
  pantalla (`aria-valuenow` + `aria-valuetext`) y recalculan en vivo.
- **Backend FastAPI**: los endpoints sobre datos reales responden 200
  (`/api/comunas`, `/api/comunas/{nombre}`, `/api/comunas/estaciones/auditoria`,
  `/api/pm25`, `/api/pm25/relaciones-anuales`, `/api/pm25/estaciones`,
  `/api/siembra/zonas`, `/api/siembra/zonas/geojson`,
  `/api/siembra/resumen-comuna`, `/api/siembra/ranking-comunas`,
  `/api/zonas-verdes`, `/api/arboles/resumen-comuna`, `/api/arboles/clusters`,
  `/api/arboles/puntos`, `/api/salud/resumen-comuna`, `/api/comunas/poblacion`).
- **Ranking AHP con pesos por defecto** reproduce exactamente
  (`ranking_prioridad` 1-5 verificado) el CSV original del pipeline
  (`resumen_recomendacion_por_comuna.csv`).
- **Modo oscuro/claro** consistente en las 3 páginas — verificado que
  `MapLegend`, `MapLayerToggles` y `AhpScenarioComparator` usan tokens del
  sistema de diseño (Fase 0), sin color hardcodeado que rompa el toggle.
- **Limpieza**: `/debug/data` eliminado (confirmado 404), sin
  `console.log`/`console.warn` de debugging en el código.

### `/api/salud/resumen-comuna` → NUEVO (2026-08-12), fuente Metrosalud vía datos.gov.co

Diagnósticos respiratorios (CIE-10 J00-J99) por comuna, agregados desde
"Perfil de morbilidad de la ESE Metrosalud" (`datos.gov.co`, dataset
`pypc-7h3w`) vía consultas SoQL del lado del servidor — nunca se descargan
las >1M filas crudas. Detalle completo (método, caveat metodológico, rango
temporal) en `backend/README.md`, sección "Fuente de
`salud_respiratoria_resumen_comuna.json`".

**Sesgo obligatorio a preservar en cualquier consumo futuro de este dato**:
Metrosalud es la red pública/régimen subsidiado — el dato es "carga
respiratoria en la red pública", no morbilidad total de la ciudad. El campo
`metodologia` de la respuesta es obligatorio (no opcional) precisamente para
que este caveat no se pierda en integraciones futuras. Fuente independiente
del modelo AHP (que sigue usando exclusivamente sus datasets originales) y
del inventario del SAU (Fase de árboles).

### Monitoreo de errores en producción (Sentry) → NUEVO (2026-08-14)

Además del CI (regresiones antes de merge) y Vercel Analytics (tráfico), el
proyecto ahora reporta a [Sentry](https://sentry.io) los errores no
manejados que ocurren **después** del deploy — algo que antes solo se
detectaba si un usuario lo reportaba manualmente.

- **Frontend** (`ecodata-lab-frontend/instrumentation.ts`,
  `src/instrumentation-client.ts`, `sentry.server.config.ts`,
  `sentry.edge.config.ts`, `src/app/global-error.tsx`): proyecto Sentry tipo
  "Next.js", DSN en `NEXT_PUBLIC_SENTRY_DSN` (variable pública, como
  `NEXT_PUBLIC_MAPBOX_TOKEN` — debe agregarse también en Vercel).
- **Backend** (`backend/app/main.py`, inicializado si `SENTRY_DSN` está
  presente en `backend/.env` / variables de entorno de Render): proyecto
  Sentry tipo "Python/FastAPI", DSN distinto al del frontend (son proyectos
  separados en Sentry).
- **Filtrado de ruido intencional**: los estados de dominio ya manejados —
  503 de dataset no disponible (p. ej. `/api/zonas-verdes` mientras no
  existía el dataset, ver arriba) y 422 de validación de pesos AHP que no
  suman 1.0 — están excluidos explícitamente vía `before_send` (backend) y
  `beforeSend` sobre `ApiError` (frontend), para que Sentry solo reporte
  errores reales del sistema (500+, excepciones de render no capturadas),
  no comportamiento esperado.
- **Sample rate**: 10% de trazas de performance (free tier tiene cuota
  mensual de eventos); errores se capturan al 100%. Session Replay no está
  habilitado (no aporta al objetivo de diagnóstico y consume cuota aparte).
- Verificado en vivo con un error deliberado en cada lado (removido del
  código tras confirmar en el dashboard de Sentry): `throw new Error(...)`
  en una ruta temporal del frontend y `1/0` en un endpoint temporal del
  backend.

### `/api/comunas/poblacion` → NUEVO (2026-08-14), fuente DANE vía Alcaldía de Medellín

Población, área (km²) y densidad (hab/km²) de las 21 comunas/corregimientos,
desde las proyecciones DANE 2018-2030 (año elegido: **2024**, ver
justificación en `backend/README.md`, sección "Fuente de
`poblacion_por_comuna.csv`"). Habilita dos cosas nuevas:

- **Dashboard y mapa**: columna de población/densidad en `ComunasTable` y
  nueva sección en `ComunaDetailPanel`.
- **`/api/salud/resumen-comuna` enriquecido**: cada comuna ahora trae
  `tasa_por_1000_hab` (diagnósticos ÷ población total × 1000) junto al
  conteo absoluto que ya existía — nunca en su reemplazo. El campo
  `metodologia` se extendió para explicar el matiz del denominador
  (población total DANE, no población atendida por Metrosalud). El
  dashboard y `ComunaDetailPanel` ahora tienen un toggle "Conteo
  absoluto" / "Tasa /1.000 hab." en la sección de salud respiratoria.

**No se tocó el modelo AHP** (`app/services/ahp.py`,
`resumen_recomendacion_por_comuna.csv`, `/api/siembra/resumen-comuna`,
`/api/siembra/ranking-comunas`): esta integración es aditiva, igual que las
del SAU y salud respiratoria antes.

**Decisión sobre el cruce de comunas**: se evaluó migrar el cruce del
proyecto de nombre normalizado a código DANE (Decreto 346 de 2000) y se
decidió **no hacerlo** en esta ronda por alcance — detalle completo,
incluyendo la justificación de por qué valdría la pena hacerlo eventualmente,
en `backend/README.md`, sección "Cruce de comunas". Como parte de extender
el mecanismo de nombre normalizado al nuevo dataset, se corrigió un bug real
preexistente en `matchComuna.ts`/`comuna_join.py`: no se despojaba el
prefijo `"Corregimiento de "`, por lo que `ComunaDetailPanel` nunca lograba
cruzar los datos de salud respiratoria de los 5 corregimientos con la
comuna seleccionada en el mapa.

## 2. Limitaciones conocidas (documentadas, no ocultas)

### `/api/zonas-verdes` → RESUELTO (2026-08-04) con fuente oficial GeoMedellín

**Actualización 2026-08-04**: se consiguió el archivo real desde el portal
oficial de datos abiertos de la Alcaldía de Medellín (**GeoMedellín**),
reemplazando la limitación documentada abajo. 48.348 polígonos, CRS
EPSG:9377, colocado en `backend/data/inventario_zonas_verdes.geojson`.
`/api/zonas-verdes` responde **200** (confirmado con curl: coordenadas en
rango válido de Medellín, no las coordenadas planas EPSG:9377 originales).
El payload se optimiza de 71MB a ~23MB (simplify + set_precision + recorte
de columnas de detalle no usadas — detalle completo en
`backend/README.md`, sección "Fuente de `inventario_zonas_verdes.geojson`").
El toggle de la capa en el frontend ya no muestra "Datos no disponibles";
queda **apagado por defecto** (el usuario la activa a conciencia) porque
sigue siendo la capa más pesada del mapa incluso optimizada. La
investigación original que sigue abajo se conserva como registro de por qué
el dataset estuvo ausente durante las fases 1-6.

#### Investigación original (503, archivo ausente en el repo fuente)
Se reabrió esta investigación (2026-08-03) clonando el repo fuente completo
(`https://github.com/nena0237/visualizacion-de-datos`, los 9 commits de su
historia completa, en una carpeta temporal fuera del monorepo) para descartar
que el archivo estuviera en alguna ruta o commit no revisado antes. Resultado:

- Búsqueda por nombre de archivo (`*zona_verde*`, `*zonas_verde*`,
  `*cobertura*`, `*inventario*`) en todo el árbol de trabajo: solo aparecen
  `dashboard/mapa_coropletico_pm25_zonas_verdes.py` y sus `.png` de salida
  (mapas ya renderizados), nunca un dataset fuente.
- Búsqueda en **todo el historial de git** (`git log --all --diff-filter=A`)
  por cualquier archivo alguna vez agregado bajo una ruta que contenga
  `zonas_verdes` o `base_datos_zonas_verdes`: cero resultados en los 9
  commits del repo (`git log --oneline | wc -l` → 9). No hay `.gitignore` que
  explique una exclusión deliberada.
- El propio código del repo fuente confirma que el archivo nunca estuvo ahí:
  tanto `dashboard/mapa_coropletico_pm25_zonas_verdes.py` (línea 25) como
  `scripts/bloque_2/bloque2_recomendador_siembra.py` (línea 80, variable
  `RUTA_ZONAS`) apuntan a la misma ruta hardcodeada
  `../../bases_de_datos/base_datos_zonas_verdes/geojson_inventario_zonas_verdes/inventario_zonas_verdes.geojson`,
  una carpeta `base_datos_zonas_verdes/` que **no existe en ningún commit**
  del repo — es una dependencia externa que el autor original tenía en su
  máquina local (probablemente un shapefile de la Alcaldía/Área
  Metropolitana descargado aparte) y nunca subió al repositorio público.
  Esto también explica por qué `resumen_recomendacion_por_comuna.csv` solo
  cubre 11 de las 21 comunas/corregimientos (ver diagnóstico de comunas sin
  score más abajo): `bloque2_recomendador_siembra.py` usa ese mismo archivo
  ausente (`gdf_zonas`) como fuente de los polígonos candidatos de siembra,
  así que su cobertura territorial real e incompleta se hereda a todo el
  pipeline.

**Veredicto: confirmado, es una limitación real del dataset fuente, no un
bug del backend ni del frontend.** No hay nada que copiar ni convertir. El
endpoint está completamente implementado y responderá 200 en cuanto el
archivo exista en la ruta configurada en `DATA_INVENTARIO_ZONAS_VERDES`. El
frontend maneja esto con gracia: el toggle de la capa "Zonas verdes
(inventario)" aparece deshabilitado con la nota "Datos no disponibles" en vez
de fallar silenciosamente o romper el mapa. No se modificó código de
backend/frontend en esta ronda porque no hay nada que conectar: si en el
futuro la Secretaría entrega el archivo real, basta con colocarlo en
`backend/data/inventario_zonas_verdes.geojson` (reproyectando a WGS84 si no
viene ya en ese CRS, igual que los demás GeoJSON del proyecto — ver
`backend/app/services/data_loader.py`); el endpoint empezará a responder 200
automáticamente, sin cambios de código adicionales.

### Comunas sin score AHP: diagnóstico definitivo (2026-08-03)

Se investigó si las comunas sin `score_multicriteria` en
`resumen_recomendacion_por_comuna.csv` eran así por falta real de datos en la
fuente o por un bug de cruce de nombres (tildes/mayúsculas) en algún punto
del pipeline o del frontend. Metodología: comparar (1) los 19 archivos Excel
de árboles por comuna en el repo fuente
(`base_datos_arboles/ARBOLES/Data_Raw/ARBOLES_TOTALES/*.xlsx`), (2) el
diccionario `GEOJSON_NOMBRE_MAP` usado tanto en `bloque_1` como en `bloque_2`
para normalizar los nombres del GeoJSON catastral, y (3) las 11 filas de
`resumen_recomendacion_por_comuna.csv`.

**Medellín tiene 21 unidades (16 comunas + 5 corregimientos). El CSV de
recomendación solo cubre 11: Guayabal, Belén, Castilla, La Candelaria, El
Poblado, Robledo, La América (con score real) y Aranjuez, Buenos Aires,
Laureles Estadio, San Javier (con `score_multicriteria = 0` y
`ranking_prioridad = 99` porque no tienen estación de PM2.5 cercana, aunque sí
tienen zonas candidatas de siembra).** Las otras 10 (Manrique, Popular, Santa
Cruz, Doce de Octubre, Villa Hermosa, y los corregimientos de San Cristóbal,
Santa Elena, San Antonio de Prado, San Sebastián de Palmitas y Altavista) no
aparecen en absoluto en el CSV.

Veredicto comuna por comuna para las 10 ausentes:

| Comuna/corregimiento | ¿Tiene Excel de árboles en la fuente? | ¿Nombre coincide (normalizado) con `GEOJSON_NOMBRE_MAP` y con el frontend? | Veredicto |
|---|---|---|---|
| Manrique | Sí (`MANRIQUE.xlsx`) | Sí | Sin datos en la fuente (sin zona candidata de siembra ni estación PM2.5 cercana) |
| Popular | Sí (`POPULAR.xlsx`) | Sí | Sin datos en la fuente |
| Santa Cruz | Sí (`SANTA_CRUZ.xlsx`) | Sí | Sin datos en la fuente (tiene estación PM2.5 según `auditoria_estaciones_comunas.csv`, pero no aparece con zona de siembra candidata → falta en el archivo ausente de zonas verdes, no un bug de nombre) |
| Doce de Octubre | Sí (`DOCE_OCTUBRE.xlsx`) | Sí | Sin datos en la fuente |
| Villa Hermosa | Sí (`VILLA_HERMOSA.xlsx`) | Sí | Sin datos en la fuente (mismo caso que Santa Cruz: tiene estación PM2.5 pero no zona candidata) |
| Corregimiento de San Cristóbal | Sí (`CORRE_SAN_CRISTOBAL.xlsx`) | Sí | Sin datos en la fuente (mismo caso: tiene estación PM2.5, no zona candidata) |
| Corregimiento de Santa Elena | Sí (`CORRE_SANTA_ELENA.xlsx`) | Sí | Sin datos en la fuente (mismo caso) |
| Corregimiento de San Antonio de Prado | Sí (`CORRE_SAN_ANTONIOP.xlsx`) | Sí | Sin datos en la fuente |
| Corregimiento de San Sebastián de Palmitas | Sí (`CORRE_SAN_SEBASTIAN.xlsx`) | Sí | Sin datos en la fuente |
| Corregimiento de Altavista | Sí (`CORRE_ALTAVISTA.xlsx`) | Sí | Sin datos en la fuente |

**San Antonio de Prado**: Existen estaciones históricas de monitoreo (PM10)
en esta zona (campañas SISAIRE 2010-2011 y 2017), pero nunca midieron
PM2.5 — el contaminante relevante para este modelo no tiene cobertura
histórica ni vigente aquí. Ver `docs/BRECHA_MONITOREO_AIRE.md`.

Es decir: **ninguna de las 10 comunas sin score falta por un bug de cruce de
nombres** — los 19 archivos Excel existen para todas ellas y sus nombres
normalizados coinciden exactamente con el diccionario `GEOJSON_NOMBRE_MAP`
(que ya incluye tildes y las formas largas de corregimiento correctas, p. ej.
`"SAN CRISTOBAL": "Corregimiento de San Cristóbal"`). La causa raíz es que
`bloque2_recomendador_siembra.py` construye el CSV de recomendación a partir
del spatial join entre las comunas y el archivo ausente
`inventario_zonas_verdes.geojson` (ver sección anterior): si esa capa de
zonas candidatas no cubre una comuna, esa comuna simplemente no genera fila
en el CSV, sin importar si tiene árboles inventariados o estación de PM2.5.
Cuatro comunas (Santa Cruz, Villa Hermosa, San Cristóbal, Santa Elena) sí
tienen estación de PM2.5 pero tampoco aparecen — confirma que el filtro
decisivo es la cobertura de esa capa de zonas verdes ausente, no el cruce de
nombres.

**Único bug de cruce de nombres real que sí se encontró — en el frontend de
este proyecto, ya corregido**: la comuna 11 es "Laureles - Estadio" en el
CSV de siembra/PM2.5 pero el GeoJSON catastral (`limite_catastral_de_comun.geojson`)
solo trae el nombre `"LAURELES"` en mayúsculas sin la segunda palabra. Sin un
alias explícito, la normalización por mayúsculas/tildes NO resuelve esta
diferencia (son cadenas distintas, no solo un problema de acentos). Esto está
documentado y corregido en
`ecodata-lab-frontend/src/lib/map/matchComuna.ts` vía el diccionario
`NAME_ALIASES` (`"LAURELES ESTADIO": "LAURELES"`), y se confirmó que
`ComunaDetailPanel.tsx` y `MapCanvas.tsx` usan `normalizeComunaName()` en
todos los cruces relevantes. No se encontró el mismo bug replicado en el
pipeline Python original (`GEOJSON_NOMBRE_MAP` en `bloque_2` ya mapea
`"LAURELES": "Laureles Estadio"` correctamente en esa dirección), así que no
hay hallazgo nuevo que reportar aguas arriba.

**Manejo de "comuna sin score" en el frontend — confirmado, ya existía y
está completo:** `ComunaDetailPanel.tsx` (líneas 71-77) muestra el mensaje
explícito "Esta comuna no tiene zonas de siembra priorizadas en el modelo
actual: el pipeline de recomendación (AHP) no calculó un score para ella con
los datos fuente disponibles" cuando `resumenQuery.isSuccess && !resumen`.
`MapCanvas.tsx` (tooltip, línea ~305-310) retorna `null` en vez de mostrar
datos falsos cuando no hay `resumen` para la comuna bajo el cursor. No se
necesitó ningún cambio de código en esta ronda: el manejo ya era correcto y
completo antes de esta investigación.

**ACTUALIZADO 2026-08-18 — de las 10 comunas sin dato, 4 ya tienen score AHP
calculado.** Al cruzar el inventario REAL de zonas verdes
(`inventario_zonas_verdes.geojson`, GeoMedellín) en vez de depender del
archivo de zonas candidatas ausente, se confirmó que **4 comunas con prioridad
AHP calculada pero sin sitio de siembra específico (Santa Cruz, Villa Hermosa,
San Cristóbal, Santa Elena)** sí tienen dato PM2.5 y por tanto score AHP
calculable — solo carecían de una zona verde viable dentro de su polígono en
el inventario real. Persistidas en
`backend/data/scores_ahp_extendido_sin_siembra.csv` y servidas combinadas con
las 11 originales en `/api/siembra/resumen-comuna` (campos
`fuente_score`/`tiene_zona_siembra`; ver `backend/README.md`, sección
"Comunas con score AHP pero sin zona de siembra"). El comparador de
sensibilidad AHP (`/api/siembra/ranking-comunas`) no se tocó y sigue
devolviendo exactamente las 11 comunas originales. Quedan **6 comunas aún sin
datos de PM2.5 (Manrique, Popular, Doce de Octubre, San Antonio de Prado, San
Sebastián de Palmitas, Altavista) — pendiente de cobertura de estaciones** —
esas 6 no cambiaron y siguen mostrando su estado "sin datos" tal cual antes.

**ACTUALIZADO 2026-08-18 (segunda ronda) — panorama honesto y completo de
las 21 comunas/corregimientos.** Se hizo point-in-polygon real (contra
`limite_catastral_de_comun.geojson`, EPSG:9377) para confirmar que ninguna
estación SIATA (ni las 14 conocidas de `auditoria_estaciones_comunas.csv`, ni
las ~12 adicionales de la red metropolitana descubiertas en el endpoint
público del SIATA) cae dentro de las 6 comunas restantes. De esas 6, se
dividieron en dos grupos según distancia real a la estación más cercana:

- **Popular, Manrique, Doce de Octubre** (1.5–2.1 km, zona urbana continua):
  se calculó PM2.5 por interpolación espacial IDW (4 estaciones SIATA reales
  más cercanas, exponente 1/distancia²) y su score AHP completo, con
  confianza **"media"** marcada explícitamente en toda la UI. Ver
  `backend/README.md`, sección "PM2.5 interpolado (IDW)", y
  `backend/scripts/calcular_pm25_interpolado_idw.py`.
- **Altavista, San Antonio de Prado, San Sebastián de Palmitas** (6.6–6.7 km,
  terreno de ladera/rural): la distancia real a las estaciones SIATA
  invalida el supuesto de homogeneidad espacial local que sostiene el IDW,
  así que **no se generó ningún número por interpolación** para ninguna de
  las 3. Ver siguiente actualización para Altavista.

**ACTUALIZADO 2026-08-18 (tercera ronda) — PM2.5 histórico real para
Altavista, y confirmación de brecha de monitoreo para las 2 comunas
restantes.** Investigación en SISAIRE/IDEAM (fuente independiente de SIATA)
encontró una estación real de PM2.5 dentro de Altavista — **MED-ALTA2** ("IE
Débora Arango, Altavista"), operada por Corantioquia, activa 2021-10-17 a
2025-09-25 — que no estaba en el CSV local del proyecto. Se calculó su score
AHP completo con el promedio del último año de datos antes de la
inactivación (14.6834639424498 µg/m³, n=249 lecturas), marcado
explícitamente como **cuarto nivel de confianza**: dato real pero **no
vigente** (`fuente_score="historico_no_vigente"`,
`pm25_tipo_dato="historico"`, la estación lleva ~11 meses inactiva). Ver
`backend/README.md`, sección "Altavista — PM2.5 histórico real, no vigente".

Para San Antonio de Prado y San Sebastián de Palmitas se confirmó, cruzando
dos fuentes independientes (SIATA + SISAIRE/IDEAM), que es una **brecha real
de infraestructura de monitoreo** — no una limitación de este proyecto. San
Antonio de Prado tuvo 2 estaciones históricas (SISAIRE 2010-2011 y 2017)
pero **solo midieron PM10, nunca PM2.5**. San Sebastián de Palmitas no tiene
ninguna estación de ninguna autoridad ambiental registrada en SISAIRE para
Medellín. Ver `docs/BRECHA_MONITOREO_AIRE.md` (hallazgo de política pública,
insumo para la Secretaría de Medio Ambiente). **No se generó ningún número**
para ninguna de las 2.

**Resumen final de las 21 comunas/corregimientos (5 niveles de confianza)**:

| Categoría | Cuántas | Comunas | `fuente_score` / `pm25_tipo_dato` |
|---|---|---|---|
| Dato real medido, con zona de siembra | 11 | Belén, Robledo, Aranjuez, Castilla, Guayabal, Laureles Estadio, El Poblado, La América, San Javier, Buenos Aires, La Candelaria | `pipeline_original` / `medido` |
| Score AHP calculado, sin zona de siembra viable (PM2.5 medido) | 4 | Santa Cruz, Villa Hermosa, San Cristóbal, Santa Elena | `recalculo_zonas_verdes_reales` / `medido` |
| Score AHP calculado, PM2.5 **interpolado** (IDW, confianza media) | 3 | Popular, Manrique, Doce de Octubre | `interpolado_idw` / `interpolado` |
| Score AHP calculado, PM2.5 **histórico real, no vigente** (estación inactiva ~11 meses) | 1 | Altavista | `historico_no_vigente` / `historico` |
| Sin ningún dato — brecha real de monitoreo (documentada, no se fuerza un número) | 2 | San Antonio de Prado, San Sebastián de Palmitas | — |

11 + 4 + 3 + 1 + 2 = 21. `/api/siembra/ranking-comunas` (comparador de
sensibilidad AHP) sigue devolviendo exactamente las 11 comunas de la primera
fila — nunca se tocó, confirmado con test automatizado
(`test_ranking_comunas_no_incluye_comunas_sin_zona_de_siembra`).

### Árboles 3D: ubicaciones reales del SAU (ACTUALIZADO 2026-08-14), muestra sigue siendo parcial

`TreeInstances` (árboles "existentes", verdes) usaba posiciones sintéticas
dispersas dentro del polígono de la comuna (`randomPointsInPolygon`) — el
usuario reportó que se veían sistemáticamente sobre edificios, poco
realista. Se reemplazó por coordenadas reales del SAU
(`/api/arboles/puntos`, mismo endpoint/hook que ya alimenta la capa
clustered del mapa a zoom cercano, sin lógica de consulta duplicada), pedidas
con el bbox de la comuna completa (`bboxOfGeometry`, nuevo en
`scatterInPolygon.ts`) y un `limit` igual al cap ya existente.

Sigue sin renderizar el censo completo por comuna (serían miles de
instancias, no viable en 3D en tiempo real): el tamaño de la muestra usa el
mismo criterio de cap que antes (`arboles_totales / 25`, techo
`MAX_EXISTING_TREE_INSTANCES=220`) — lo que cambió es que ahora esa muestra
son coordenadas reales, no aproximadas. Cuando el bbox de la comuna tiene
más árboles reales que el `limit` pedido, el backend ya devuelve una
muestra **aleatoria** (no las primeras filas por orden de `objectid`) —
ver `puntos_en_bbox` en `backend/app/services/arboles.py`, cambiado en esta
misma integración para no sesgar geográficamente la muestra hacia donde
empieza el dataset fuente.

Los árboles "recomendados" (dorados, zonas de siembra) siguen siendo
centroides aproximados — representan una recomendación futura, no un árbol
plantado, así que no tenían por qué cambiar.

**Tooltip de especie real**: pasar el mouse sobre un árbol "existente"
ahora muestra `s_especie`/`nombre_comun` reales del individuo SAU más
cercano al cursor (proyectando cada punto a coordenadas de pantalla vía
`map.project()`, ver `MapCanvas.tsx` — no usa raycasting de R3F porque el
canvas de `TreeInstances` es `pointer-events: none` a propósito, para no
bloquear el pan/zoom del mapa). Los árboles "recomendados" no tienen
tooltip de especie (no hay árbol real todavía).

### Favicon
Reemplazado en la Fase 6 por un ícono de hoja estilizado (`src/app/icon.svg`
+ `src/app/favicon.ico` regenerado), en el verde primario del sistema de
diseño (`--vegetation`). Es un asset simple hecho a mano, no un logo de marca
elaborado — suficiente para que el sitio no salga con el ícono default de
`create-next-app`, pero no reemplaza un ejercicio real de identidad visual si
la Secretaría quiere uno más adelante.

### Lighthouse

Automatizado con `pnpm run lighthouse` (Lighthouse CLI vía API programática,
Chrome headless — ver `docs/lighthouse-automation.md` para cómo funciona y
cómo reutilizarlo en otro proyecto). Scores finales, post-fixes, contra el
build de producción (`pnpm build && pnpm start`):

| Página | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 30 | 100 | 77 | 100 |
| `/mapa` | 31 | 100 | 77 | 100 |
| `/dashboard` | 38-40 | 100 | 81 | 100 |

**Fixes reales aplicados y confirmados con una segunda corrida** (antes → después):
- **Accessibility `/dashboard`: 89 → 100.** El audit `aria-input-field-name`
  señaló que los sliders del comparador AHP no tenían nombre accesible: el
  `aria-label` se pasaba al `<SliderPrimitive.Root>`, pero el elemento con
  `role="slider"` real es el `<Thumb>` interno de Radix, que quedaba sin
  nombre. Corregido en `src/components/ui/slider.tsx` (el `aria-label` ahora
  se reenvía al `Thumb`, no al `Root`).
- **Best Practices, "Missing source maps": corregido en `/mapa` y
  `/dashboard`** (antes fallaba en las 3, ahora solo queda un caso aislado en
  `/`) activando `productionBrowserSourceMaps: true` en `next.config.ts`.

**Re-corrida 2026-08-04** (tras integrar `inventario_zonas_verdes.geojson`
real y dejar esa capa apagada por defecto/carga diferida — ver sección
"RESUELTO" de `/api/zonas-verdes" abajo): sin regresión, scores iguales o
mejores que la línea base de Fase 6.

| Página | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 36 | 100 | 81 | 100 |
| `/mapa` | 39 | 100 | 81 | 100 |
| `/dashboard` | 61 | 100 | 81 | 100 |

Confirma que la nueva capa (apagada por defecto, se difiere su fetch de
~23MB hasta que el usuario la activa) no degrada el score inicial de
`/mapa`. El resto de audits < 90 son los mismos ya diagnosticados abajo
(ruido de Kaspersky en el entorno local, no del código).

**Por qué Performance bajó más de lo esperado y por qué no se persigue más
en esta fase — hallazgo real, no una excusa:**

Durante el diagnóstico se descubrió, leyendo el JSON crudo del reporte (no
solo el score), que **Kaspersky** (antivirus instalado en la máquina donde se
corrió la auditoría) inyecta su propio script de telemetría
(`gc.kis.v2.scr.kaspersky-labs.com`) en el tráfico de `http://localhost` a
nivel de red — no como extensión de Chrome, sino interceptando la conexión,
por lo que persiste incluso en Chrome headless recién lanzado. Confirmado con
tres corridas independientes (antes y después de dos intentos del usuario de
desactivarlo): **el audit `is-on-https` ("Does not use HTTPS") lista
exclusivamente URLs de Kaspersky como "inseguras", nunca del propio sitio**, y
buena parte del tiempo de bloqueo de main-thread reportado corresponde a ese
script de terceros, no al código de la aplicación. Esto infla artificialmente
el score de Performance reportado en este entorno específico — el número real
en un entorno limpio (o en el deploy de producción real) sería más alto,
aunque de todas formas por debajo de 90 (ver siguiente párrafo).

Descontando ese ruido, el Performance real de la app sigue siendo bajo
(LCP/TBT elevados, "Reduce unused JavaScript" con ~900 KiB en `/` y `/mapa`)
por una razón arquitectónica **intencional, no un bug**: `HomeClient.tsx`
monta `<MapCanvas />` (mapbox-gl + deck.gl + three.js) de forma inmediata y
permanente como fondo fijo de toda la landing, porque el scroll-telling de la
Fase 3 depende de que la cámara del mapa esté sincronizada con el scroll
desde la primera sección — no es un mapa que aparece más adelante en la
página. Retrasar esa carga mejoraría el score pero rompería la experiencia
central del producto (el mapa como protagonista visual desde el primer
scroll), así que **no se aplicó** — es un trade-off de producto explícito,
documentado aquí en vez de aplicado en silencio, tal como pide la restricción
de la Fase 5/6 de no cambiar comportamiento visible sin decirlo. En un deploy
real a Vercel (CDN, HTTP/2, sin la interferencia de un antivirus local) estos
números deberían mejorar por sí solos, pero seguirán reflejando el costo real
de cargar tres librerías 3D/mapas de forma inmersiva.

### Framerate de `/mapa`
No se pudo medir de forma automatizada en este entorno (el contador vía
`requestAnimationFrame` se pausa cuando la pestaña no está en foco durante la
automatización del navegador). Se solicitó al usuario medirlo manualmente
(DevTools → Performance, o el medidor de FPS del navegador) durante el cierre
de la Fase 6; **pendiente de actualizar este documento con el número real**
una vez lo confirme.

### Diagnóstico de rendimiento 2026-08-18 — modo "Ciudad completa" en `/mapa`

Investigación disparada por un reporte de lentitud general y un caso concreto:
zoom a nivel de calle en modo "Ciudad completa" (`TreeModeSelector`) se siente
lento. Metodología: medición real (curl con timing, `pnpm run lighthouse`
contra el build de producción, `pnpm build` para el reporte de bundle), no
inspección de código sola. La revisión de código previa (misma fecha) ya
había confirmado que `useMemo` en las capas de deck.gl, `@lru_cache` en
`data_loader.py` y el cap de 3000 puntos en `puntos_en_bbox` ya existen; esta
sección añade los números que faltaban.

**Limitación de esta corrida**: la extensión de Chrome (`claude-in-chrome`) no
estaba conectada en este entorno, así que no se pudo capturar el Network real
del gesto de zoom en vivo (cuántas requests a `/api/arboles/puntos` dispara un
zoom continuo hasta calle, con qué timing exacto). Queda pendiente para quien
tenga la extensión conectada. Lo que sí se confirmó por código (ver revisión
previa) es que el trigger es el evento `moveend` de Mapbox — que dispara una
vez por gesto completo, no en cada tick de `move`/`zoom` — así que la
hipótesis de "request sin debounce en cada tick" no tiene soporte en el
código tal cual está.

**1. Backend — tiempos reales con `curl -w "%{time_total}"` (bbox de zoom de
calle en el centro de Medellín, `min_lon=-75.5720&min_lat=6.2400&max_lon=-75.5620&max_lat=6.2480`):**

| Endpoint | Local (cold, primera carga del dataset) | Local (warm, `lru_cache` caliente) | Render (warm) |
|---|---|---|---|
| `/api/arboles/puntos` (bbox calle) | 1.13 s | **0.16 s** — payload 333 KB | 0.76–1.24 s — payload 333 KB |
| `/api/zonas-verdes` (23 MB completo) | **55.0 s** | 1.83 s (payload sigue siendo 23 MB) | **502 en ~1 s** (ver hallazgo abajo) |

- `arboles/puntos` con `lru_cache` caliente responde en 160 ms local y bajo
  1.3 s contra Render — la diferencia Local↔Render (~0.6–1 s) es latencia de
  red pura, no cómputo: el backend de Render **no** está en cold-start ahora
  mismo (si lo estuviera, el timeout de 90 s del propio curl lo habría hecho
  evidente, como sí pasó con zonas-verdes). Esto descarta el "cold start de
  Render de 30-50 s documentado en otro lado" como causa del caso reportado,
  al menos para este endpoint.
- **Hallazgo nuevo, no relacionado con el caso reportado pero real**:
  `/api/zonas-verdes` devuelve **502 en producción (Render)**. La primera
  carga local del mismo endpoint tarda 55 s en construir el DataFrame/GeoJSON
  de 23 MB desde cero (una sola vez, gracias a `@lru_cache` — la segunda
  petición local baja a 1.8 s), pero en el plan gratuito de Render esa misma
  construcción parece exceder el timeout del proxy/worker antes de completarse,
  y el 502 se sirve casi instantáneo en reintentos (probablemente cacheado por
  el borde de Render, no reintentado contra la app). Como la capa de zonas
  verdes está apagada por defecto (confirmado en la sección de Lighightouse de
  Fase 6 arriba), esto no afecta la carga inicial de `/mapa`, pero si un
  usuario la activa en producción, probablemente falla. **No corregido en esta
  sesión** — está fuera del alcance del caso reportado (modo "Ciudad completa"
  de árboles) y merece su propia investigación (¿subir a un plan con más
  memoria/timeout, paginar la respuesta, o precomputar y servir el GeoJSON
  desde almacenamiento estático?).

**2. Lighthouse — `pnpm run lighthouse` contra el build de producción real
(`pnpm build && pnpm start`), apuntando `NEXT_PUBLIC_API_URL` a Render
(`.env.local` tal cual está en el repo):**

| Página | Performance (Fase 6, 2026-08-04) | Performance (2026-08-18) | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| `/` | 36 | **42** | 96 | 77 | 100 |
| `/mapa` | 39 | **32** | 97 | 77 | 100 |
| `/dashboard` | 61 | **20** | 100 | 77 | 100 |

`/` mejoró levemente; `/mapa` bajó 7 puntos; `/dashboard` cayó fuerte, de 61 a
20. Mirando los audits crudos de esta corrida:

- `/dashboard`: LCP 10.2 s, TBT 5,380 ms, CLS 0.343 (antes no reportado en el
  doc de Fase 6). El salto de score no tiene una causa de código identificada
  en esta sesión — no se tocó `/dashboard` en cambios recientes del repo
  (los commits recientes son sobre el mapa y Sentry). Candidatos sin
  confirmar: latencia real de Render sirviendo los datos de los gráficos
  (`ranking-comunas`, `salud-resumen-comuna`, etc. — varias requests
  secuenciales a un backend en Ohio/Oregon desde esta máquina), o ruido del
  entorno local (el propio doc de Fase 6 ya documentó interferencia de
  Kaspersky inflando TBT en local). No se puede distinguir sin repetir la
  corrida en un entorno limpio o contra el backend local — **queda como
  hallazgo abierto, no como regresión confirmada de código**.
- `/mapa`: LCP 13.9 s, TBT 14,950 ms, TTI 26.2 s — igual de imposible de achacar
  a un cuello de botella específico del modo "Ciudad completa" (Lighthouse
  audita la carga inicial de la página, no el gesto de zoom del caso
  reportado; el modo árboles no está activo por defecto). "Reduce unused
  JavaScript" (~1 MB) y "Avoid enormous network payloads" (5.2 MB total)
  siguen siendo los mismos issues estructurales ya documentados en Fase 6
  (mapbox-gl + deck.gl + three.js cargados de forma inmersiva a propósito).
- Nuevo en las tres rutas: **"Browser errors were logged to the console"**
  (Best Practices, score 0) — no estaba en el reporte de Fase 6. No se
  investigó el contenido exacto del error en esta sesión (sin Chrome
  conectado no se pudo leer la consola en vivo) — queda pendiente.

**3. Bundle / code-splitting (`pnpm build`, Next 16.2.12 + Turbopack):**

Build en modo Turbopack de este Next.js ya no imprime la tabla de tamaño por
ruta (`First Load JS`) que sí mostraba Webpack — no hay números comparables
directos contra un baseline de Fase 6 con este comando. Verificado en su
lugar por grep + inspección de `.next/static/chunks/`:

- Los únicos `next/dynamic(...)` en el árbol de componentes siguen siendo
  `src/components/landing/HomeClient.tsx` y `src/components/map/MapaClient.tsx`
  — son los que cargan `MapCanvas` (mapbox-gl + deck.gl + three.js). No se
  coló ningún import estático nuevo de esas libs en código compartido fuera de
  los archivos ya esperados (`MapCanvas.tsx`, `layers/*.ts`, `TreeInstances.tsx`,
  `flyTo.ts`, y los componentes de gráficos de `/dashboard` que importan
  `recharts` directamente, que es el patrón ya documentado). El code-splitting
  por ruta sigue intacto.
- El chunk JS más grande generado es de **1.83 MB** (`.next/static/chunks/`,
  vendor de mapbox-gl/deck.gl/three), seguido de uno de 1.41 MB — consistente
  con "Avoid enormous network payloads: 5.2 MB total" que reportó Lighthouse
  para `/mapa`.

**Conclusión y decisión — no se aplicó ninguna de las 4 optimizaciones
candidatas del prompt original:**

- **Debounce de zoom**: descartado por código — `moveend` ya no dispara por
  tick.
- **Memoización de capas deck.gl**: ya existe, confirmada intacta tras los
  cambios de modo dual.
- **Caché backend**: ya existe (`@lru_cache` en 13+ loaders); el 502 de
  zonas-verdes en Render es un problema de infraestructura/timeout del plan
  gratuito, no de falta de caché — cachear más no lo arregla, porque el
  cómputo ya está cacheado y el problema es el primer cómputo en frío bajo el
  límite de tiempo de Render.
- **Bajar el límite de puntos en "Ciudad completa"**: sin poder capturar el
  Network real del gesto de zoom (Chrome no conectado), no hay evidencia de
  que el cuello de botella percibido sea el repintado de buffers WebGL de
  deck.gl con 3000 puntos — el payload (333 KB) y el tiempo de respuesta
  cacheado (160 ms local) no sugieren que sea ahí. Bajar el límite sin esa
  evidencia violaría la restricción explícita de "no reduzcas volumen/calidad
  de datos hasta agotar lo demás primero, y no optimices sin evidencia".

**Siguiente paso recomendado, no ejecutado en esta sesión**: repetir el punto
2 del diagnóstico (captura de Network en vivo del gesto de zoom, con la
extensión de Chrome conectada) para confirmar o descartar la hipótesis de
costo de repintado WebGL, y decidir desde ahí si el límite de puntos en
"Ciudad completa" necesita bajar. Investigar aparte el 502 de
`/api/zonas-verdes` en Render (fuera del alcance del caso reportado). Repetir
la corrida de Lighthouse de `/dashboard` contra el backend local (sin latencia
de Render) para aislar si la caída de 61→20 es red o código.

### Seguimiento 2026-08-19 — los dos pendientes de la Fase C

Con la extensión de Chrome conectada, se resolvieron los dos pendientes
dejados arriba.

**1. Captura de Network en vivo del gesto de zoom en "Ciudad completa"**
(`pnpm build && pnpm start`, backend real de Render, `claude-in-chrome`
navegando `/mapa`, activando "Ciudad completa" y haciendo zoom hasta nivel
de calle):

- Se confirma por comportamiento real, no solo por código: cada gesto de
  zoom/pan completo (una vez que la cámara se asienta, `moveend`) dispara
  **exactamente un** request a `/api/arboles/puntos` con el bbox del
  viewport en ese momento — no uno por tick de scroll ni un request
  duplicado por bbox idéntico. Dos gestos consecutivos (p. ej. seleccionar
  una comuna con doble-click y luego ajustar el zoom con scroll) producen
  dos requests, cada uno con un bbox **distinto** (verificado comparando
  hash de la query string de cada request vía `performance.getEntriesByType`),
  consistente con dos `moveend` reales, no con un fetch duplicado.
- **Nota sobre un falso positivo encontrado primero**: en `pnpm dev` (no en
  el build de producción) sí se observó `/api/arboles/puntos` disparado dos
  veces con el bbox **idéntico**, ~100 ms aparte. Se investigó y es
  `reactStrictMode: true` (`next.config.ts`) — React vuelve a invocar
  efectos dos veces solo en desarrollo para detectar side-effects impuros,
  nunca en producción. Repetir la misma secuencia contra `pnpm start` (build
  de producción real, lo que corre en Render) no mostró el duplicado. No es
  un bug real de cara al usuario — quede documentado para que nadie lo
  vuelva a investigar creyendo que es nuevo.
- **Tamaño/tiempo real por request** (medido con `curl` contra Render para
  los mismos bbox observados en el navegador):
  - `/api/arboles/clusters` (vista de ciudad completa, zoom < 15): **15 KB,
    2.24 s**.
  - `/api/arboles/puntos` (bbox de calle en una zona densa de El Poblado/La
    Candelaria, cerca del cap de 3000 puntos — banner "se muestran 3000
    máx." visible en el mapa): **682 KB, 1.21 s**. Compatible con el rango
    333 KB–700 KB ya documentado arriba según densidad de árboles de la
    zona.
  - Ningún request individual se acerca a un problema de timeout — el
    cuello de botella de UX percibido, si existe, no está en el network.
- **Conclusión**: no hay evidencia de requests redundantes ni de payloads
  desproporcionados causando la lentitud percibida en "Ciudad completa". La
  hipótesis de costo de repintado WebGL (deck.gl recreando buffers con hasta
  3000 puntos) sigue sin confirmarse ni descartarse — esta captura de
  Network no mide FPS/tiempo de frame, solo tráfico HTTP. Si se quiere
  cerrar esa pregunta, el siguiente paso sería perfilar con el panel
  Performance de Chrome DevTools durante el gesto de zoom, no Network.

**2. Segunda corrida de `pnpm run lighthouse`** (mismo setup: `pnpm build &&
pnpm start`, `NEXT_PUBLIC_API_URL` apuntando a Render vía `.env.local`, sin
tocar código entre corridas):

| Página | Fase 6 (2026-08-04) | 2026-08-18 | 2026-08-19 (esta corrida) |
|---|---|---|---|
| `/` | 36 | 42 | **28** |
| `/mapa` | 39 | 32 | **29** |
| `/dashboard` | 61 | 20 | **15** |

La caída de `/dashboard` **no fue ruido de la medición anterior** — se
repite, y en esta corrida incluso bajó un poco más (20→15), no rebotó hacia
61. Las otras dos páginas también bajaron frente al 2026-08-18, lo que
apunta a una causa compartida entre las tres rutas (más consistente con
variabilidad de esta máquina/red hacia Render que con algo específico del
código de `/dashboard` — ninguna de las tres tiene commits recientes propios
que expliquen una regresión de código). **Sigue sin ejecutarse** el paso ya
recomendado de repetir Lighthouse contra el backend local (sin latencia de
Render) para aislar definitivamente red vs. código — con dos corridas ya
mostrando la misma caída fuerte y consistente, ese aislamiento es ahora más
urgente que antes de descartarlo como ruido.

### Fase D (2026-08-19) — Auditoría de viabilidad de zonas de siembra

**Hallazgo de calidad de datos.** Un usuario reportó zonas de siembra
recomendadas (`zonas_priorizadas_siembra.geojson`) cayendo sobre canchas o
parques. Se investigó y se confirmó: el pipeline original filtra por
`cober_dom` (Grama/Tierra) y excluye `categoria` privada, pero nunca miró
`subcategoria` (Plaza/Plazoleta/Plazuela/Parqueaderos) ni
`infraestructura`/`equipamiento` (nombre del predio, p. ej. "Unidad
Deportiva Atanasio Girardot") — dos columnas del inventario real de
GeoMedellín que sí distinguen una cancha de una zona verde real. **Nota**:
se descartó primero la hipótesis de que el pipeline usaba un dataset menos
detallado — es falsa; el script original ya usaba este mismo inventario
como fuente (verificado: las 1.648 zonas comparten `id_poligono` y
`Shape_Area` exactos con su contraparte en el inventario completo).

Se construyó una auditoría por overlay espacial
(`backend/scripts/auditar_viabilidad_siembra.py`, metodología completa en
`backend/README.md` sección "Auditoría de viabilidad de zonas de siembra")
que **NO modifica** `zonas_priorizadas_siembra.geojson` — marca cada zona
con `viabilidad_auditada` (`consistente` | `posible_no_viable` |
`sin_solape_con_inventario_real`), servido como capa adicional que
`/api/siembra/zonas/geojson` inyecta por `id_poligono`.

| `viabilidad_auditada` | Zonas | % |
|---|---|---|
| `consistente` | 1.514 | 91.9% |
| `posible_no_viable` | 134 | 8.1% |
| `sin_solape_con_inventario_real` | 0 | 0.0% |

**8.1% de las zonas recomendadas** se solapan con infraestructura
deportiva/recreativa dura o con subcategoría de plaza/plazoleta —
principalmente dentro de la Unidad Deportiva Atanasio Girardot (56 zonas) y
la Unidad Deportiva de Belén (22 zonas). Estas zonas **no se eliminaron ni
se excluyeron**: la decisión de qué hacer con cada una queda para revisión
humana de la Secretaría, no automatizada (restricción explícita del
prompt). En el mapa (`/mapa`), estas zonas se ven con borde rojo grueso (sin
ocultar el relleno) y, al hacer click, un panel explica el motivo y ofrece
un atajo "Ver en satelital" que cambia el estilo del mapa y centra la
cámara ahí para verificar a simple vista.

**Nota sobre el toggle satelital**: el prompt de Fase D asumía que ya
existía "de una fase anterior" — se verificó (código + `git log`) que no
existía ningún estilo satelital ni toggle en el proyecto hasta esta sesión;
se construyó desde cero (`mapStore.ts`: `mapStyle`/`toggleMapStyle`,
`MapLayerToggles`) en vez de solo "confirmarlo".

### Fase E1 (2026-08-19) — Excluir zonas no viables de la recomendación activa

**Cambio de comportamiento, no de datos**: hasta la Fase D, las 134 zonas
marcadas `posible_no_viable` por la auditoría (se solapan con cancha/plaza/
unidad deportiva real) se mostraban en el mapa igual que las demás, solo con
borde rojo de advertencia — decisión deliberada en su momento para no
alterar el output del pipeline original sin instrucción explícita. En esta
sesión el **dueño del proyecto tomó esa decisión explícitamente**: que las
134 zonas dejen de presentarse como recomendación activa por defecto.

**No es un cambio automático del sistema ni una decisión tomada por
Claude** — se documenta así porque es importante que quede claro que la
exclusión respondió a una instrucción directa del dueño del proyecto, no a
una inferencia de "esto probablemente es lo que quieren". El principio de
"no ocultar, marcar" de la Fase D se mantiene: los datos en disco
(`zonas_priorizadas_siembra.geojson`, `auditoria_viabilidad_siembra.geojson`)
no cambiaron un byte — esto es un filtro de presentación en
`zonasSiembraLayer.ts`, reversible con un toggle.

**Qué cambió**:
- `createZonasSiembraLayer` (`zonasSiembraLayer.ts`) recibe un parámetro
  `mostrarDescartadas` (default `false`): cuando es `false`, filtra las
  features `posible_no_viable` antes de pasarlas a deck.gl — no llegan ni a
  renderizarse.
- Nuevo toggle **"Mostrar zonas descartadas (auditoría)"** en
  `MapLayerToggles`, anidado bajo "Zonas priorizadas de siembra" (solo
  visible si esa capa está activa) — apagado por defecto. Al activarlo,
  las 134 zonas reaparecen con el mismo tratamiento visual ya construido en
  la Fase D y la miniatura satelital (borde rojo, tooltip de aviso, panel
  con miniatura al click): no se duplicó ninguna lógica, el toggle solo
  controla qué llega al array de features de la capa.
- Los conos 3D "recomendados" de Respiro Urbano (`MapCanvas.tsx`, dentro de
  `treePoints`) respetan el mismo filtro/toggle — son otra representación
  visual de la misma recomendación, no tenía sentido excluir las zonas del
  mapa 2D pero seguir mostrando sus conos 3D.
- Nota de conteo en `MapLayerToggles`: "N zonas recomendadas (M
  adicionales descartadas por auditoría de terreno — activa este toggle
  para verlas)", calculada en el propio frontend desde el GeoJSON que ya
  alimenta el mapa — no esconde el hallazgo, solo dice claramente que esas
  M no forman parte de la recomendación activa por defecto.
- `MapLegend.tsx` actualizado: aclara que el borde rojo ya no es visible
  por defecto y cómo activarlo.

**Qué NO cambió (confirmado explícitamente)**: `resumen.n_zonas_disponibles`
en `ComunaDetailPanel` (el "Zonas priorizadas" del panel de comuna) sigue
viniendo tal cual del resumen AHP del backend
(`resumen_recomendacion_por_comuna.csv` / las fuentes complementarias) — es
un dato del pipeline original, calculado en el servidor, sin relación con
qué esté visible en el mapa del cliente en un momento dado. El comparador
AHP (`/api/siembra/ranking-comunas`) tampoco se tocó: sigue usando
`recomendacion_siembra_por_zona.csv` completo en el backend, ajeno a este
filtro de presentación del mapa. La nota de conteo nueva vive en
`MapLayerToggles` precisamente para no mezclarse con esos números del
backend ni sugerir que están relacionados.

### Fase E2 (2026-08-19) — Panel rico de zona de siembra (área, especie, justificación)

Al hacer click en una zona de siembra viable, el mapa ahora abre un panel
(`ZonaSiembraDetailPanel`, mismo lugar/estilo que el panel de zona dudosa de
la Fase D) con: **área** real (m² o ha, lo que sea más legible), **especie
recomendada**, **por qué esa especie** (rango altitudinal y tipo de suelo
reales de su ficha botánica) y **beneficio esperado** (individuos
recomendados × eficiencia de mitigación de PM2.5 — cualitativa, no un
número inventado).

**Fuente de datos real**: el catálogo `ESPECIES` embebido en el script
original `Visualizacion-de-datos/scripts/bloque_2/bloque2_recomendador_siembra.py`
(la fuente que el modelo AHP ya usa para elegir especie por zona), cruzado
con las fichas scrapeadas del Catálogo de Flora del Valle de Aburrá (EIA) —
todo consolidado en `backend/data/fichas_especies.json`. Nuevo endpoint
`GET /api/siembra/zona/{id}/detalle`. Metodología completa (fórmula de
individuos recomendados, por qué NO se calcula un número de PM2.5
mitigado) en `backend/README.md`, sección "Detalle de zona de siembra
(Fase E2)".

**Hallazgo de cobertura**: 5 especies documentadas (todo el catálogo
`ESPECIES` del pipeline). De ellas, **3 de 3 (100%)** son la especie
recomendada de alguna zona real (Zygia longifolia, Calliandra
haematocephala, Inga densiflora — 1.648 zonas en total); las otras 2
(Bauhinia picta, Retrophyllum rospigliosii) solo aparecen como especies
alternativas, nunca como recomendación principal. Cobertura completa: no
hay ninguna zona activa cuyo panel deba mostrar "sin ficha disponible" hoy
— pero el panel maneja ese caso explícitamente (`ficha_especie: null`) por
si el pipeline recomienda una especie nueva sin ficha en el futuro.

**Restricción respetada explícitamente**: no existe en ninguna fuente real
del proyecto un valor numérico de PM2.5 mitigado por individuo (µg/año) —
solo la calificación cualitativa `pm25_eficiencia` (Alta/Media/Baja) que el
propio pipeline deriva de la densidad de follaje. Se investigó y se
descartó explícitamente inventar una fórmula de µg × cupo de árboles: el
panel muestra la calificación cualitativa real en vez de un número
inexistente.

### Fase E3 (2026-08-19) — Diversificación de especies por zona (exploratoria)

Medimos, con los mismos criterios reales que usa el pipeline
(`especie_para_zona()`: rango altitudinal + `categoria` de la zona — nunca
tipo de suelo, que no es evaluable por falta de dato comparable por zona),
cuántas de las 5 especies documentadas (Fase E2) son compatibles con cada
una de las 1.648 zonas — no solo la que el pipeline ya eligió como
"óptima". Metodología completa, incluyendo por qué se usó la constante de
altitud única del pipeline (`ALTITUD_MEDELLIN=1495`) en vez de inventar
altitud por zona, en `backend/README.md`, sección "Diversificación de
especies por zona (Fase E3)".

**Hallazgo principal**: 62.3% de las zonas (1.027 de 1.648) tienen 2+
especies compatibles — mucho más margen del que anticipaba la premisa
pesimista del prompt original. Pero el cuello de botella real resultó ser
otro: 881 de esas 1.027 zonas tienen menos de 10 individuos de cupo (umbral
mínimo documentado para que diversificar tenga sentido ecológico) y quedan
excluidas. Resultado final: **solo 146 zonas (8.9%) reciben una propuesta
de diversificación real** (`backend/data/diversificacion_especies_siembra.geojson`,
reparto equitativo con método de mayor resto, documentado en el README).

**Recomendación explícita entregada**: NO priorizar la Fase E4 (más fuentes
de especies) todavía — la escasez de especies documentadas no es hoy el
cuello de botella real (ya hay 2+ opciones en el 62.3% de las zonas con
solo 5 especies). Si se quiere ampliar el alcance de esta función, revisar
primero si el umbral de 10 individuos es demasiado conservador (decisión de
la Secretaría, no técnica) antes de invertir en documentar más especies.

**Frontend**: en el panel de zona (`ZonaSiembraDetailPanel`), sección
plegable "Ver propuesta de diversificación" — solo visible cuando aplica,
etiquetada explícitamente como "Propuesta exploratoria de este proyecto, no
la recomendación oficial del modelo original". Si no aplica, muestra el
motivo real (solo 1 especie compatible, o cupo insuficiente) en vez de
ocultar la sección sin explicación. `zonas_priorizadas_siembra.geojson` y
`recomendacion_siembra_por_zona.csv` sin cambios (verificado por hash).

### Fase E4 (2026-08-19) — Biodiversidad de fauna (GBIF/SiB Colombia): EVALUADA, pospuesta conscientemente

**Estado: no integrada — decisión explícita del dueño del proyecto, no un
olvido.** Igual que con el estrato socioeconómico (ver "Limitaciones
conocidas" arriba), esta idea se investigó con datos reales antes de
decidir, en vez de descartarla o aceptarla sin evidencia. Queda este
registro para que nadie la vuelva a investigar desde cero creyendo que
nunca se exploró.

**Qué se investigó**: se consultó en vivo la API pública de GBIF
(`api.gbif.org`, sin token, sin costo) contra el mismo bounding box de
Medellín ya usado en el proyecto. Hallazgos reales:
- 732.943 registros de aves, 86.874 de insectos, 18.022 de mamíferos con
  coordenadas dentro del área de la ciudad.
- 76,6% de los registros de aves vienen de eBird (observación ciudadana
  vía app) — sesgo real confirmado: más registros donde hay más
  observadores (parques y senderos populares), no necesariamente donde hay
  más biodiversidad real.
- Hallazgo positivo real: dos datasets institucionales confiables y
  recientes (2017-2025) sí existen — uno publicado por la propia
  **Secretaría de Medio Ambiente del Distrito de Medellín** (55.920
  registros de aves con coordenadas reales) y otro del **Área Metropolitana
  del Valle de Aburrá** sobre conectividad ecológica. SiB Colombia resultó
  ser el nodo GBIF que ya endosa estos datasets colombianos — consultarlo
  aparte de GBIF habría sido redundante, no complementario.
- **Ninguna fuente disponible (GBIF, SiB Colombia, ni las 5 fichas de
  especies de la Fase E2) documenta una relación ecológica específica
  entre una especie de árbol recomendada y la fauna que se beneficiaría de
  ella** — son repositorios de avistamientos, no de relaciones
  ecológicas. Presentar esa relación causal en el panel habría sido
  narrativa inventada, no un dato real.

**Por qué se pospone, no se descarta**: el dueño del proyecto determinó que
no es accionable para el enfoque central del proyecto (mitigación de
PM2.5) — agregaría una fuente externa más para mantener (recencia,
disponibilidad de la API, sesgo de observación que hay que seguir
explicando) sin cambiar ninguna decisión real que el sistema ya soporta
(dónde sembrar, qué especie, cuánta prioridad por comuna). El reporte
completo de la exploración (metodología, números exactos por dataset,
comparación GBIF vs. SiB Colombia, y qué se necesitaría para reabrirlo)
quedó entregado en la conversación de esta fase — si en el futuro se quiere
retomar, el punto de partida ya está resuelto: no haría falta repetir la
investigación, solo decidir el alcance de integración (comuna, no zona
individual, para no sobre-precisar un dato con sesgo de observación
conocido).

### Aislar la caída de Lighthouse en `/dashboard` (2026-08-19) — 61 → 20 → 15

**Pregunta que este trabajo respondió**: la caída sostenida de Performance
en `/dashboard` (y en menor medida `/` y `/mapa`) en dos corridas
consecutivas contra Render, ¿era latencia/variabilidad de red hacia el
backend remoto, o una regresión real de código? Nunca se había aislado la
variable — este trabajo lo hizo con evidencia real, no repitiendo la misma
corrida contra el mismo backend remoto una tercera vez.

**Método**: backend local (`uvicorn`, sin Render) + frontend en modo
producción real (`pnpm build && pnpm start`, no `pnpm dev`) +
`NEXT_PUBLIC_API_URL=http://localhost:8000` temporal + 3 corridas de
`pnpm run lighthouse` seguidas (no una sola).

**Resultado — NO es (solo) latencia de red hacia Render**, contra la
hipótesis de trabajo: 3 corridas locales dieron Dashboard **24, 25, 25** —
prácticamente idéntico a la corrida más reciente contra Render (15) y muy
lejos del baseline original (61). Si fuera solo latencia de red, el score
local debería haber vuelto a acercarse a 61; no lo hizo, de forma
consistente en las 3 corridas (sin ruido apreciable entre ellas).

**Causa raíz real encontrada y corregida**: `ComunaComparator.tsx` (el
comparador de comunas en `/dashboard`) llamaba a `useComunas()` —el mismo
hook que usa el mapa— solo para leer `f.properties.nombre` de los 21
polígonos. Ese endpoint (`/api/comunas`) devuelve la geometría completa de
las 21 comunas: **3.495 KB, el recurso más pesado de toda la página**, más
grande que todo el JavaScript junto. Se agregó
`GET /api/comunas/nombres` (reutiliza el mismo loader cacheado, sin costo
de cómputo adicional, solo descarta la geometría antes de responder — ver
`backend/app/routers/comunas.py`) y se cambió `ComunaComparator` para
usarlo. Verificado: el payload total de `/dashboard` bajó de 5.493 KB a
1.898 KB (-65%), y el endpoint pesado (`/api/comunas`) desapareció por
completo de las requests de esa página.

**Hallazgo honesto — el fix no movió el score de Lighthouse** (25 → 25 en
las 3 corridas post-fix): el ahorro de payload es real y vale la pena
igual (menos datos para cualquier usuario real, especialmente en conexión
lenta), pero no era el factor dominante del score específico de Lighthouse
para esta página. Diagnóstico de qué sí domina, con evidencia:

- **Kaspersky (antivirus local de esta máquina) inyecta un script en cada
  página** que consume **2.134 ms de 6.147 ms de tiempo total de arranque
  de scripts — 35%**. Esto ya se había mencionado como sospecha en el doc
  de Fase 6 ("interferencia de Kaspersky inflando TBT en local"); esta
  corrida lo cuantifica con precisión por primera vez. Es un artefacto del
  entorno de medición de esta máquina — **no es código del proyecto ni
  latencia de Render**, y no aparecería corriendo Lighthouse en CI o en una
  máquina limpia.
- **CLS real de 0.343** (score 0.32) causado por el `<footer>` de la
  página, que se desplaza hacia abajo cuando el contenido de arriba
  (tabla/gráficas con datos async) termina de cargar y crece. Es un
  hallazgo real y potencialmente corregible (reservar altura o usar
  skeletons mientras carga la tabla/gráficas), pero queda **fuera de
  alcance de este prompt** — la instrucción explícita fue no optimizar
  especulativamente más allá del culpable confirmado, y este es un segundo
  hallazgo distinto, no la causa de la caída original que se pidió aislar.
- Costo real de ejecución de JS del bundle principal (~2,8 s de scripting)
  — esperable para un dashboard con `recharts` + varias fuentes de datos
  renderizando tablas/gráficas, no investigado más a fondo en este prompt.

**Conclusión para no repetir esta investigación desde cero**: la caída de
61 a ~15-25 es real y reproducible, tanto contra Render como en local —
**no es principalmente latencia de red** (se descarta con evidencia). Sí
había una causa de código real y ya corregida (`/api/comunas` innecesario
en `/dashboard`), pero no era la dominante para el número de Lighthouse en
sí. El resto de la brecha se explica por un artefacto de esta máquina
(Kaspersky, 35% del tiempo de arranque de scripts) y por un CLS real
identificado pero no corregido en este prompt (footer desplazándose). Si se
quiere seguir subiendo el score, el candidato más prometedor ahora es el
CLS del footer, no más optimizaciones de payload — pero eso queda como
decisión explícita para un prompt futuro, no una extensión no pedida de
este.

### Corregir CLS del footer en `/dashboard` (2026-08-19) — 0.343 → 0.000

Continuación directa del hallazgo anterior: Lighthouse marcaba un CLS real
de 0.343 en `/dashboard`, con el `<footer>` como único elemento
responsable (`layout-shifts` audit, score 0.343 en un solo evento).

**Primer intento — no funcionó, y eso también es información real**: se
revisaron los 7 componentes de `/dashboard` que renderizan según
`isLoading` (`KpiCards`, `Pm25BarChart`, `Pm25TrendChart`, `ArbolesSauStats`,
`SaludRespiratoriaBarChart`, `Pm25SaludComparacion`, `ComunaComparator`,
`ComunasTable`). Tres de ellos (`Pm25BarChart`, `Pm25TrendChart`,
`SaludRespiratoriaBarChart`) ya reservaban la altura correcta (`h-72`/`h-64`
igual en loading y con datos). Los otros tres sí tenían un salto real:
`ArbolesSauStats` (una línea de 32px → tarjeta de 2 columnas), `Pm25SaludComparacion`
(bloque de 48px → tarjeta con 2 listas de 8 filas) y `ComunasTable` (bloque
de 256px → tabla con ~14 filas + buscador). Se les agregaron skeletons
reales con `src/components/ui/skeleton.tsx` (primitivo nuevo, no existía en
el proyecto — mismo patrón shadcn/ui que el resto de `components/ui/`),
del mismo tamaño aproximado que su contenido final. **Medido después: CLS
sin cambiar, 0.343 exacto** — la causa real estaba en otro lugar.

**Causa raíz real**: `DashboardClient.tsx` envuelve toda la página en un
único `<Suspense>` (necesario porque `useSearchParams()` lo exige) cuyo
`fallback` era un solo `<p>Cargando dashboard…</p>` — una línea de texto.
Cuando ese Suspense resuelve, TODO el contenido de la página
(~6.845px de alto en el viewport móvil que usa Lighthouse por defecto)
aparece de golpe en un único salto masivo — eso es lo que Lighthouse
atribuía al `<footer>` (el elemento que más se mueve cuando todo lo de
arriba aparece de una vez), y por eso ningún fix a nivel de componente
individual lo tocaba: ninguno de esos componentes llega a pintar nada
hasta después de que este Suspense de nivel superior ya resolvió.

**Fix real**: se reemplazó el fallback de una línea por
`DashboardPageSkeleton`, que reproduce la forma general de la página
completa (título + KPIs en grid + 2 tarjetas de gráfica + 4 tarjetas
genéricas), usando el mismo primitivo `Skeleton`. No necesita ser pixel
perfecto — solo evitar el salto de "una línea de texto" a "6.845px de
contenido real".

**Resultado medido** (mismo método que el prompt anterior: backend local,
`pnpm build && pnpm start`, 3 corridas de `pnpm run lighthouse` contra
`http://localhost:8000`):

| Corrida | CLS | Performance Dashboard |
|---|---|---|
| Antes del fix (3 corridas) | 0.343 / 0.343 / 0.343 | 24 / 25 / 25 |
| Después del fix (3 corridas) | **0.000 / 0.000 / 0.000** | **41 / 42 / 41** |

CLS eliminado por completo (0.343 → 0.000, muy por debajo del umbral
"bueno" de Google de 0.1). El score de Performance de Dashboard también
subió de forma consistente (~25 → ~41) — mejora real, no ruido, verificada
en 3 corridas idénticas en ambos lados.

**Kaspersky sigue interfiriendo, como en el prompt anterior — no se
confunde con la mejora real**: el antivirus local de esta máquina sigue
representando ~32% del tiempo total de arranque de scripts (2.165 ms de
6.781 ms) en las corridas post-fix. La mejora de CLS y de Performance
reportada arriba es adicional a ese ruido de entorno, no lo reemplaza — el
score real en una máquina limpia o en CI sería más alto que el 41-42
medido aquí.

**Alcance en `/` y `/mapa`** (revisión rápida, no una auditoría nueva, tal
como pedía el prompt): no se encontró un patrón comparable. `/mapa` es un
canvas de altura fija (`h-[calc(100dvh-4rem)]`) con paneles
`position: absolute` — no pueden empujar nada en el flujo del documento.
`/` (landing) tiene una sección (`ScrollSection`, `min-h-screen`) donde el
texto de un KPI cambia de "Cargando…" a una oración completa, pero la
sección ya reserva pantalla completa de alto vía `min-h-screen` y el
contenido inicia en `opacity: 0` (revelado por scroll) — no hay evidencia
de un salto de página comparable al de `/dashboard`. No se tocó código en
ninguna de las dos rutas.

## 3. Cómo correr todo desde cero

### Requisitos
- Node.js 20+ y pnpm (o `npm` como alternativa).
- Python 3.11+ con `venv`.
- Un token público de Mapbox GL JS (gratis en [mapbox.com](https://account.mapbox.com/access-tokens/)).

No hace falta clonar `Visualizacion-de-datos/` aparte: los datasets que el
backend necesita ya están copiados en `backend/data/` (organización de
monorepo para deploy, ver `docs/GUIA_MIGRACION.md`).

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # las rutas DATA_* ya apuntan a ./data/, no requieren ajuste
uvicorn app.main:app --reload
```

Verificar: `http://localhost:8000/docs` (Swagger) y
`http://localhost:8000/api/comunas` (debe responder 200).

### 2. Frontend

```bash
cd ecodata-lab-frontend
pnpm install
cp .env.local.example .env.local
# Editar .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000
#                     NEXT_PUBLIC_MAPBOX_TOKEN=<tu token>
pnpm dev
```

Abrir `http://localhost:3000`. El backend debe estar corriendo primero (o al
menos antes de navegar a `/mapa` o `/dashboard`, que dependen de sus datos).

### 3. Verificación de build de producción

```bash
cd ecodata-lab-frontend
pnpm build && pnpm lint
pnpm start   # sirve el build de producción en :3000, para medir Lighthouse real
```

### Orden recomendado al arrancar
1. Backend (`uvicorn`) — sin esto, `/mapa` y `/dashboard` muestran estados de
   carga/error, no fallan de forma silenciosa.
2. Frontend (`pnpm dev` o `pnpm start`).
3. Confirmar `NEXT_PUBLIC_MAPBOX_TOKEN` está seteado — sin él, `/mapa` muestra
   un aviso explícito en vez de intentar cargar un mapa roto.

## 4. Deploy

No se desplegó a producción real en esta fase (decisión explícita: no se
asumió por defecto, ver `docs/GUIA_MIGRACION.md` y los README de cada parte
para los pasos documentados). Instrucciones completas de deploy:
`ecodata-lab-frontend/README.md` (Vercel) y `backend/README.md`
(Railway/Render/Docker).

**Pendiente de seguridad antes de cualquier deploy real**: restringir el
token público de Mapbox por dominio en
[el dashboard de Mapbox](https://account.mapbox.com/access-tokens/) una vez se
conozca la URL de producción — documentado desde la Fase 2, repetido aquí
porque es el paso que más fácil se olvida.
