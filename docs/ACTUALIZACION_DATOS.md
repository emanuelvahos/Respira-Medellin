# Actualización periódica de datos

> Documento de referencia único: cadencia, método y riesgo de refrescar
> cada fuente de datos del proyecto. Escrito para que cualquiera (tú, en 6
> meses, o quien herede el proyecto) pueda seguirlo sin reconstruir este
> contexto desde cero.

## Por qué existe este documento

El proyecto integra 5 fuentes de datos con orígenes, formatos y ritmos de
actualización distintos. Sin un proceso documentado, el riesgo es que el
proyecto se convierta silenciosamente en una foto fija cada vez más vieja,
sin que nadie lo note hasta que alguien pregunte "¿esto está actualizado?"
y no haya una respuesta clara. Este documento es esa respuesta.

## Resumen — las 5 fuentes

| # | Fuente | Cadencia real de la fuente | Cadencia recomendada de refresco aquí | Método | Riesgo/esfuerzo |
|---|---|---|---|---|---|
| 1 | Pipeline original (Bloque 1/2, AHP) | Estática — congelada desde el inicio del proyecto | **Nunca**, sin coordinación explícita | N/A | **Alto si se toca sin validar** — ver sección 1 |
| 2 | Zonas verdes (GeoMedellín) | Portal actualizado por la Alcaldía sin calendario público conocido | Cada 6-12 meses | Manual | Medio, ~10-15 min |
| 3 | Árboles urbanos SAU | Se alimenta a diario por usuarios oficiales de la Alcaldía | Cada 3-6 meses | Script (`fetch_sau_arboles.py`) | Bajo, ~3-5 min, throttled |
| 4 | Salud respiratoria (Metrosalud) | Activa — dataset fuente actualizado recientemente (confirmado en su momento) | Cada 1-3 meses | Script (`fetch_salud_respiratoria.py`) | Bajo, ~1 min, 3 consultas agregadas |
| 5 | Población/densidad (DANE) | Proyección fija hasta 2030 | **No requiere refresco antes de 2030**, salvo que DANE publique una recalibración | Manual | Bajo si ocurre, pero infrecuente por diseño |

Detalle de cada una a continuación.

---

## 1. Pipeline original (Bloque 1/2 — modelo AHP, `resumen_recomendacion_por_comuna.csv`)

- **Qué es**: los outputs del proyecto de ciencia de datos original
  (`base_datos_arboles`, `base_datos_comunas`, `base_datos_siata`, y el
  CSV que resume el ranking AHP). Es la base sobre la que se construyó y
  **validó** todo el modelo de priorización, incluido el análisis de
  sensibilidad formal (`docs/VALIDACION_SENSIBILIDAD_AHP.md`).
- **Cadencia real de la fuente**: ninguna — es un snapshot congelado, no
  una fuente que "se actualiza".
- **Cadencia recomendada aquí**: **no re-ejecutar** salvo decisión
  explícita y coordinada, fuera del alcance de este proyecto de
  visualización.
- **Método**: N/A — no hay script de refresco en este repo para el
  pipeline original (vive en el repo de ciencia de datos original,
  `Visualizacion-de-datos/scripts/bloque_2/...`, fuera de este monorepo).
- **Riesgo/esfuerzo si se hiciera de todos modos**: **alto**. El análisis
  de sensibilidad AHP (`docs/VALIDACION_SENSIBILIDAD_AHP.md`) se hizo
  contra el estado actual de estos datos — un recálculo del pipeline
  original cambiaría los valores base de PM2.5/déficit/área por comuna, lo
  que invalidaría esa validación sin que nadie lo note a simple vista (el
  dashboard seguiría funcionando, solo mostraría números distintos sin
  ninguna alerta). **Cualquier cambio aquí requiere re-ejecutar el análisis
  de sensibilidad completo como parte del mismo trabajo**, no como una
  tarea separada "para después".

## 2. Zonas verdes (GeoMedellín / ArcGIS Hub)

- **URL de origen**: portal de datos abiertos GeoMedellín (ArcGIS Hub de la
  Alcaldía de Medellín) — ver `backend/README.md`, sección "Fuente de
  `inventario_zonas_verdes.geojson`" para el detalle exacto de la descarga
  ya realizada (fecha, tamaño, optimizaciones aplicadas).
- **Cadencia real de la fuente**: el portal se actualiza por la Alcaldía
  sin un calendario público conocido — no hay confirmación de con qué
  frecuencia cambia el inventario real de zonas verdes.
- **Cadencia recomendada aquí**: **cada 6-12 meses** es razonable. Es un
  inventario de infraestructura física (parques, zonas verdes) que no
  cambia con la velocidad de un dato transaccional como salud o tráfico;
  un refresco anual captura obras nuevas/eliminaciones sin sobre-invertir
  esfuerzo en algo que cambia lentamente.
- **Método**: **manual**, no hay script propio todavía.
  1. Ir al portal GeoMedellín / ArcGIS Hub y localizar el dataset de zonas
     verdes (mismo dataset usado en la descarga original, ver
     `backend/README.md` para el nombre exacto).
  2. Descargar como GeoJSON.
  3. Reemplazar `backend/data/inventario_zonas_verdes.geojson` (el archivo
     CRUDO, sin procesar).
  4. Confirmar que `app/models/zona_verde.py` (`ZonaVerdeInventarioProperties`,
     `extra="allow"`) sigue aceptando las columnas del nuevo archivo — si el
     portal cambió el esquema (columnas renombradas/eliminadas), revisar
     también `procesar_zonas_verdes_geojson` en `data_loader.py`
     (usa `tipologia`, `categoria`, `cober_dom`, etc. explícitamente).
  5. **Correr `python backend/scripts/preprocesar_zonas_verdes.py`** —
     regenera `backend/data/zonas_verdes_procesado.geojson` (reproyección +
     simplify de los ~48k polígonos, ~10-15s). Este paso es obligatorio: el
     endpoint `/api/zonas-verdes` sirve el archivo procesado directamente y
     NUNCA reprocesa el crudo en tiempo de request (ver backend/README.md,
     sección "Por qué /api/zonas-verdes sirve un archivo precomputado") —
     olvidar este paso deja el mapa mostrando el inventario viejo aunque el
     crudo ya se haya reemplazado.
  6. **Correr `python backend/scripts/auditar_viabilidad_siembra.py`** —
     regenera `backend/data/auditoria_viabilidad_siembra.geojson` (Fase D,
     ver backend/README.md sección "Auditoría de viabilidad de zonas de
     siembra"). También obligatorio si cambió el inventario: el campo
     `viabilidad_auditada` que sirve `/api/siembra/zonas/geojson` queda
     desincronizado en silencio si no se regenera. Corre en segundos (overlay
     espacial de ~1.650 zonas contra el inventario).
  7. Corre este mismo paso 6 también si lo que cambió es
     `zonas_priorizadas_siembra.geojson` (sección 1, aunque esa fuente esté
     fuera de alcance de refresco rutinario) — la auditoría cruza ambos
     archivos, así que un cambio en cualquiera de los dos la invalida.
  8. Correr `pytest` en `backend/` y `pnpm build` en el frontend para
     confirmar que nada rompe.
- **Riesgo/esfuerzo**: medio. ~10-15 minutos, posible necesidad de cuenta
  en el portal según cómo esté configurada la descarga; el mayor riesgo no
  es el proceso de descarga sino un cambio de esquema no detectado (por
  eso el paso 4 explícito arriba) o el olvido de los pasos 5-6 (regenerar
  el archivo procesado y la auditoría de viabilidad).

## 3. Árboles urbanos SAU (ArcGIS REST, Alcaldía de Medellín)

- **URL de origen**: servicio ArcGIS REST público
  `VA_SistemaArbolUrbano_Ciudadano/MapServer/1` (ver docstring de
  `backend/scripts/fetch_sau_arboles.py` para la URL completa y el detalle
  de paginación).
- **Cadencia real de la fuente**: se alimenta **a diario** por usuarios
  oficiales de la Alcaldía (intervenciones, nuevos individuos, cambios de
  estado fitosanitario).
- **Cadencia recomendada aquí**: **cada 3-6 meses**. Aunque la fuente
  cambia a diario, el propósito de este proyecto (visualización agregada
  por comuna, no seguimiento operativo individuo por individuo) no
  necesita esa frecuencia — un snapshot cada pocos meses sigue siendo
  representativo del inventario real sin generar ruido de refrescos
  constantes ni carga innecesaria al servicio de la Alcaldía.
- **Método**: **script existente**, `backend/scripts/fetch_sau_arboles.py`.
  ```
  python backend/scripts/fetch_sau_arboles.py
  ```
  Descarga con paginación (`resultRecordCount=2000`, tope real del
  servicio) y throttling (`--sleep`, 1s por defecto entre páginas) ya
  construidos — **no quitar el throttling** para acelerar una ejecución
  puntual, ni siquiera en un cron: es infraestructura pública de la
  Alcaldía sin SLA de rate limit, no una API comercial pensada para carga
  alta.
- **Riesgo/esfuerzo**: bajo. ~3-5 minutos para las ~340.000 filas actuales
  (170 páginas × ~1s), sin autenticación, deduplicación por `objectid` ya
  incorporada como red de seguridad. Automatizable — ver sección
  "Automatización" más abajo.

## 4. Morbilidad respiratoria (Metrosalud, vía Socrata / datos.gov.co)

- **URL de origen**: "Perfil de morbilidad de la ESE Metrosalud"
  (`datos.gov.co`, dataset `pypc-7h3w`) — ver docstring de
  `backend/scripts/fetch_salud_respiratoria.py` y `backend/README.md`,
  sección "Fuente de `salud_respiratoria_resumen_comuna.json`".
- **Cadencia real de la fuente**: **activa** — el dataset se actualiza con
  regularidad (confirmado en la exploración original que dio origen al
  script).
- **Cadencia recomendada aquí**: **cada 1-3 meses**. Es la fuente con
  cadencia real más alta de las 5, y es un indicador de salud pública
  sensible al tiempo (picos estacionales, etc.) — vale la pena refrescarla
  con más frecuencia que zonas verdes o SAU.
- **Método**: **script existente**, `backend/scripts/fetch_salud_respiratoria.py`.
  ```
  python backend/scripts/fetch_salud_respiratoria.py
  ```
  Hace **3 consultas SoQL agregadas** del lado del servidor
  (`$select`/`$where`/`$group`) — nunca descarga las >1.048.575 filas
  crudas de atenciones individuales. Sin App Token de Socrata configurado
  (uso puntual y bajo volumen); si se automatiza con más frecuencia,
  registrar uno gratis en https://dev.socrata.com/docs/app-tokens y
  pasarlo como variable de entorno.
- **Riesgo/esfuerzo**: bajo. ~1 minuto, 3 requests. El único riesgo real no
  es de carga sino de contenido: si el refresco cambia sustancialmente el
  campo `metodologia` o el sesgo documentado (red pública/régimen
  subsidiado), eso debe revisarse antes de aceptar el refresco — ver
  checklist más abajo.

## 5. Población/densidad (DANE, vía Alcaldía de Medellín)

- **URL de origen**: portal de centro documental de la Alcaldía de
  Medellín — ver `backend/README.md`, sección "Fuente de
  `poblacion_por_comuna.csv`" para la URL exacta y la justificación del
  año elegido (2024).
- **Cadencia real de la fuente**: son **proyecciones ya calculadas hasta
  2030** (Actualización DANE julio 2025) — no es una serie que cambie mes
  a mes, es fija por diseño hasta que DANE publique una recalibración
  completa (la anterior fue en 2020).
- **Cadencia recomendada aquí**: **ninguna antes de 2030**, salvo que DANE
  publique una nueva actualización de las proyecciones (poco frecuente:
  la última fue en 2025, la anterior en 2020 — cadencia real de ~5 años).
  Si eso ocurre, vale la pena revisar si conviene cambiar también el año
  elegido (`ANIO_ELEGIDO` en el script, ver abajo).
- **Método**: **manual**, sin script de descarga automática (es un Excel
  con un formato particular — título/metadata en las primeras 15 filas,
  corregimientos con dos filas a sumar — que no vale la pena automatizar
  dada la cadencia de años entre actualizaciones).
  1. Descargar el Excel actualizado desde
     `https://www.medellin.gov.co/es/centro-documental/proyecciones-poblacion-viviendas-y-hogares/`
     (dominio principal `medellin.gov.co`, **no** `medata.gov.co` — ver
     nota de certificado vencido en `backend/README.md`).
  2. Reemplazar `backend/data/proyecciones_poblacion_comunas.xlsx`.
  3. Revisar si `ANIO_ELEGIDO` en
     `backend/scripts/procesar_poblacion_comunas.py` sigue siendo la
     elección correcta (ver justificación en el propio script y en
     `backend/README.md`) o si conviene actualizarlo a un año más reciente
     de la nueva serie.
  4. Correr `python backend/scripts/procesar_poblacion_comunas.py` — valida
     automáticamente que salgan 21 filas y que la suma total esté en el
     rango ~2-3M habitantes (`assert` en el propio script).
  5. Correr `pytest` en `backend/` para confirmar que nada rompe (incluye
     el cruce con salud respiratoria, que depende de este dataset para la
     tasa por 1.000 hab.).
- **Riesgo/esfuerzo**: bajo cuando ocurre, pero es infrecuente por diseño
  — no vale la pena invertir en automatizarlo.

---

## Automatización: decisión sobre SAU y salud respiratoria

Ambas fuentes (secciones 3 y 4) ya tienen script de descarga propio con
throttling apropiado, lo que las hace candidatas razonables a automatizar.
**Se decidió automatizarlas** con un workflow de GitHub Actions separado
del CI de build/test: `.github/workflows/refresh-data.yml`.

**Por qué automatizar estas dos y no las otras tres**:
- Zonas verdes y población son manuales porque **no tienen script** (el
  esfuerzo de construir uno no se justifica dada su cadencia de
  refresco de meses o años).
- El pipeline original está explícitamente fuera de alcance (ver sección 1).
- SAU y salud respiratoria sí tienen script, throttling ya resuelto, y una
  cadencia de refresco (3-6 meses / 1-3 meses) lo bastante frecuente como
  para que recordar hacerlo manualmente cada vez sea un punto real de
  fricción y olvido.

**Cómo funciona el workflow** (`.github/workflows/refresh-data.yml`):
- **Cron trimestral** (día 1 de enero/abril/julio/octubre), más
  `workflow_dispatch` para poder dispararlo manualmente desde la pestaña
  Actions sin esperar al cron si hace falta un refresco puntual.
- Dos jobs independientes (uno por fuente), cada uno:
  1. Corre el script existente **sin modificar su throttling**.
  2. Si el archivo de datos cambió, abre un **Pull Request** (vía
     `peter-evans/create-pull-request`) con el diff — **nunca hace merge
     automático**. Si no hay cambios, el workflow termina sin crear PR.
- El cuerpo del PR incluye instrucciones explícitas de qué revisar antes
  de aprobar (ver plantillas en el propio workflow).
- Es un workflow **separado** de `ci.yml` (build/test en cada push/PR):
  este corre por calendario, no en cada cambio de código, y su propósito
  es distinto (refrescar datos, no validar código).

**Por qué trimestral para ambas, aunque salud respiratoria podría
justificar mensual**: se eligió una única cadencia de cron para mantener
el workflow simple (dos jobs, un solo `schedule`) en vez de dos triggers
de cron distintos. Trimestral es el punto medio razonable entre los rangos
recomendados de ambas fuentes (3-6 meses SAU, 1-3 meses salud). Si en el
futuro se necesita refrescar salud respiratoria con más frecuencia,
`workflow_dispatch` cubre ese caso puntual sin tener que cambiar el cron;
separar los crons es una mejora futura simple si la cadencia mensual
resulta necesaria en la práctica.

## Checklist de refresco (paso a paso, para cualquier fuente)

Sigue esto literalmente, sin necesidad de reconstruir contexto:

1. **Identifica la fuente** a refrescar y su sección correspondiente arriba
   (1 a 5).
2. **Si es SAU o salud respiratoria y solo quieres adelantar el refresco
   automático**: ve a la pestaña *Actions* del repo → `Refresh data
   (trimestral)` → *Run workflow* (`workflow_dispatch`). Espera el PR, ve
   al paso 6.
3. **Si es SAU o salud respiratoria manualmente (sin usar el workflow)**,
   o **zonas verdes/población (siempre manuales)**: sigue el método
   descrito en la sección de esa fuente arriba.
4. **Después de reemplazar el archivo en `backend/data/`**: corre
   `pytest` desde `backend/` (con el entorno virtual activado) — todos los
   tests deben seguir pasando.
5. **Corre el backend localmente** (`uvicorn app.main:app --reload`) y
   pega el endpoint afectado en el navegador o `curl` (ver tabla de
   endpoints en `backend/README.md`) para confirmar que responde 200 con
   datos que tienen sentido (conteos razonables, sin columnas vacías
   inesperadas).
6. **Si el refresco vino de un PR automático**: revisa el diff del archivo
   de datos (tamaño del cambio, comunas afectadas) siguiendo las
   instrucciones del propio cuerpo del PR antes de aprobar y mergear.
7. **Corre `pnpm build` y `pnpm lint`** en `ecodata-lab-frontend/` — un
   cambio de datos no debería romper el build, pero si el esquema de algún
   dataset cambió (columnas nuevas/eliminadas en la fuente), puede afectar
   la validación Zod del frontend (`src/types/*.ts`).
8. **Actualiza la fecha de descarga** en la sección correspondiente de
   `backend/README.md` (cada fuente documenta su fecha de descarga —
   mantenla al día).
9. Si el refresco tocó el pipeline original (sección 1) por cualquier
   motivo excepcional: **re-ejecuta el análisis de sensibilidad AHP**
   (`docs/VALIDACION_SENSIBILIDAD_AHP.md`) como parte del mismo cambio, no
   como tarea separada.
