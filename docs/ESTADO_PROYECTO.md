# Estado del proyecto — EcoData Lab Medellín

> Inventario honesto de qué funciona, qué quedó documentado como limitación, y
> cómo levantar todo desde cero. Escrito al cierre de la Fase 6 (entrega
> final). Ver también `docs/GUIA_MIGRACION.md` para el contexto de por qué la
> arquitectura es la que es.

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

### Árboles 3D: muestra, no censo completo
`TreeInstances` no renderiza el censo real de árboles por comuna (serían
miles de instancias); usa una muestra representativa cuyo tamaño se deriva
del dato real (`arboles_totales / 25`, con techo `MAX_EXISTING_TREE_INSTANCES`).
Esto es una decisión de performance explícita de la Fase 3/5, no una
regresión — está documentado en el propio código
(`src/components/map/MapCanvas.tsx`, comentario junto a `treePoints`).

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
