# Brecha de monitoreo de calidad del aire (PM2.5) — San Antonio de Prado y San Sebastián de Palmitas

**Fecha de la investigación: 2026-08-18.**

## Hallazgo de política pública

Este proyecto identificó, mediante cruce de dos fuentes independientes
(SIATA y SISAIRE/IDEAM), que **San Antonio de Prado y San Sebastián de
Palmitas no cuentan con ninguna estación de monitoreo de calidad del aire
(PM2.5) de ninguna autoridad ambiental**. Esta es una **brecha real de
infraestructura de monitoreo en el territorio**, no una limitación de este
proyecto ni un vacío de procesamiento de datos. Se documenta aquí en tono
factual para que la Secretaría de Medio Ambiente de Medellín pueda usarlo
como insumo directo para justificar la instalación de nuevas estaciones en
estos dos corregimientos.

## Metodología

1. **Fuente 1 — SIATA**: se cruzaron, mediante point-in-polygon real contra
   el límite catastral de comuna (`limite_catastral_de_comun.geojson`,
   EPSG:9377), las 21 estaciones actuales de la red SIATA (las 14 conocidas
   de `auditoria_estaciones_comunas.csv` más las ~7 estaciones adicionales
   de la red metropolitana descubiertas en el endpoint público de SIATA).
   Ninguna cae dentro de los polígonos de San Antonio de Prado o San
   Sebastián de Palmitas.
2. **Fuente 2 — SISAIRE/IDEAM**: se consultó la base de datos completa de
   SISAIRE para el departamento de Antioquia / municipio de Medellín (las 3
   páginas completas de la consulta), y se aplicó el mismo point-in-polygon
   real contra los límites catastrales de ambos corregimientos.
   - **San Antonio de Prado**: se encontraron 2 estaciones históricas
     confirmadas dentro del polígono (campañas cortas 2010-2011 y 2017), pero
     **ambas midieron únicamente PM10, nunca PM2.5** — el contaminante
     relevante para el modelo de priorización de siembra de este proyecto.
     PM10 y PM2.5 son magnitudes distintas (PM2.5 es la fracción más fina y
     la de mayor impacto respiratorio); una estación de PM10 no sustituye a
     una de PM2.5.
   - **San Sebastián de Palmitas**: cero estaciones de cualquier autoridad
     ambiental en toda la base de SISAIRE para Medellín. Vacío de monitoreo
     total, confirmado con las dos fuentes.

## Resultado

| Corregimiento | Estaciones SIATA (PM2.5) | Estaciones SISAIRE (PM2.5) | Estaciones SISAIRE (otro contaminante) |
|---|---|---|---|
| San Antonio de Prado | 0 | 0 | 2 (PM10, campañas 2010-2011 y 2017, inactivas) |
| San Sebastián de Palmitas | 0 | 0 | 0 |

Ninguna de las dos comunas tiene, ni ha tenido nunca, monitoreo directo de
PM2.5. Por esta razón el sistema **no genera ningún score AHP ni valor de
PM2.5** para estas dos comunas — a diferencia de Altavista (que sí tuvo una
estación de PM2.5 real, aunque hoy inactiva; ver `backend/README.md`,
sección "Altavista — PM2.5 histórico real, no vigente"), aquí no existe
ningún dato histórico del contaminante que se pueda usar como aproximación.

## Recomendación (insumo para la Secretaría de Medio Ambiente)

La instalación de al menos una estación de monitoreo de PM2.5 en cada uno de
estos dos corregimientos permitiría:

- Incorporarlos al modelo de priorización de siembra AHP de este proyecto
  con un dato medido real (el nivel de confianza más alto del sistema).
- Cerrar el único vacío de cobertura de monitoreo de PM2.5 que persiste,
  entre los 21 comunas/corregimientos de Medellín, después de la
  integración de datos interpolados (Popular, Manrique, Doce de Octubre) e
  históricos (Altavista) descrita en `docs/ESTADO_PROYECTO.md`.

## Ver también

- `docs/ESTADO_PROYECTO.md` — panorama completo de las 21
  comunas/corregimientos y sus 5 niveles de confianza de dato.
- `backend/README.md` — secciones "Comunas con score AHP pero sin zona de
  siembra", "PM2.5 interpolado (IDW)" y "Altavista — PM2.5 histórico real,
  no vigente".
