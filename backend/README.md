# EcoData Lab Medellín — Backend (Fase 1)

Capa de servicio FastAPI que envuelve los datasets ya generados por el
pipeline de ciencia de datos (`Visualizacion-de-datos/scripts/bloque_1` y
`bloque_2`). **No recalcula** el modelo AHP ni el spatial join: solo lee los
CSV/GeoJSON existentes, los tipa con Pydantic v2 y los expone como JSON
válido (o GeoJSON `FeatureCollection` real para las capas geoespaciales).

## Gestor de entorno: `venv` + `pip`

Se usó `venv` estándar (no Poetry) por simplicidad y porque no hay
publicación de paquete — solo un servicio interno.

## Instalación

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Configuración

```bash
cp .env.example .env
```

Las rutas `DATA_*` de `.env.example` ya apuntan a `backend/data/` (los
datasets están copiados ahí, versionados junto al código — no requieren tener
`Visualizacion-de-datos/` clonado al lado para correr el backend). Normalmente
no hace falta tocarlas; solo ajústalas si mueves los archivos de lugar.

## Ejecución

```bash
uvicorn app.main:app --reload
```

- API: http://localhost:8000
- Documentación interactiva (Swagger): http://localhost:8000/docs

## Testing

Suite `pytest` (fase 1: sin CI todavía) enfocada en la lógica más frágil del
backend — el ranking AHP (`app/services/ahp.py`) y la reproyección de
geometrías (`app/services/data_loader.py`) — más smoke tests de los
endpoints principales con `fastapi.testclient.TestClient`. Corre contra los
datasets reales de `backend/data/` (hermético: sin llamadas de red).

```bash
cd backend
.venv\Scripts\activate   # o `source .venv/bin/activate` en macOS/Linux
pytest
```

Cobertura: `pytest --cov=app --cov-report=term-missing`.

`backend/tests/`:
- `test_ahp.py` — orden real del ranking con pesos por defecto (0.45/0.35/0.20),
  422 cuando los pesos no suman 1.0, un peso custom válido que cambia el
  orden, maximizar el peso de PM2.5 sube a la comuna con peor PM2.5 real, y
  casos límite de pesos en 0/1.
- `test_data_loader.py` — un punto real de `limite_catastral_de_comun.geojson`
  (EPSG:9377) reproyectado cae en el rango geográfico de Medellín.
- `test_endpoints.py` — `/`, `/health`, `/api/comunas`,
  `/api/siembra/resumen-comuna`, `/api/siembra/ranking-comunas` (pesos por
  defecto, custom, y 422), `/api/salud/resumen-comuna`, y un 503 simulado
  monkeypatcheando el loader para representar un dataset ausente.

## Scripts de ETL

`backend/scripts/fetch_sau_arboles.py` descarga (throttled, paginado) el
inventario real de árboles del SAU desde el servicio ArcGIS REST público de
la Alcaldía y lo guarda en `backend/data/sau_arboles_urbanos.csv`. No corre
automáticamente ni en el build ni en el deploy — es una descarga puntual que
ya se ejecutó una vez (ver "Fuente de `sau_arboles_urbanos.csv`" abajo); solo
hace falta volver a correrlo si se necesita refrescar el dataset:

```bash
cd backend
python scripts/fetch_sau_arboles.py
```

## Endpoints

| Método | Ruta | Fuente | Descripción |
|---|---|---|---|
| GET | `/api/comunas` | `limite_catastral_de_comun.geojson` | Límite catastral de comunas + corregimientos (GeoJSON, WGS84) |
| GET | `/api/comunas/{nombre}` | idem | Filtra por nombre de comuna |
| GET | `/api/comunas/estaciones/auditoria` | `auditoria_estaciones_comunas.csv` | Trazabilidad estación SIATA → comuna |
| GET | `/api/comunas/poblacion` | `poblacion_por_comuna.csv` | Población, área (km²) y densidad (hab/km²) de las 21 comunas/corregimientos — ver "Fuente de `poblacion_por_comuna.csv`" abajo |
| GET | `/api/pm25?comuna=&anio=` | `integracion_v2_pm25_arboles_medellin.csv` | PM2.5 × cobertura arbórea por comuna/periodo |
| GET | `/api/pm25/relaciones-anuales?comuna=&anio=` | `relaciones_v2_bloque2.csv` | Relaciones anuales comuna × vulnerabilidad |
| GET | `/api/pm25/estaciones` | `Solicitud_PM25_DP1763941.csv` + `auditoria_estaciones_comunas.csv` | Última lectura real de PM2.5 por estación SIATA (no agregada por comuna); pensado para capas que necesitan variación espacial genuina, p. ej. partículas animadas |
| GET | `/api/siembra/zonas?comuna=` | `recomendacion_siembra_por_zona.csv` | Recomendación de siembra por zona (~1.649 filas) |
| GET | `/api/siembra/zonas/geojson` | `zonas_priorizadas_siembra.geojson` | Geometría de zonas priorizadas (GeoJSON, WGS84) |
| GET | `/api/siembra/resumen-comuna` | `resumen_recomendacion_por_comuna.csv` + `scores_ahp_extendido_sin_siembra.csv` + `scores_ahp_interpolado_idw.csv` + `scores_ahp_altavista_historico.csv` | Score AHP y ranking agregado por comuna (11 comunas con zona de siembra + 4 comunas con score pero sin zona + 3 comunas con PM2.5 **interpolado, no medido** + Altavista con PM2.5 **histórico, no vigente** — ver "Comunas con score AHP pero sin zona de siembra", "PM2.5 interpolado (IDW)" y "Altavista — PM2.5 histórico real, no vigente" abajo) |
| GET | `/api/siembra/ranking-comunas?peso_pm25=&peso_deficit=&peso_area=` | recalculado (ver abajo) | Ranking AHP con pesos custom (comparador de escenarios, Fase 4) |
| GET | `/api/zonas-verdes` | `inventario_zonas_verdes.geojson` | Inventario real de zonas verdes (48.348 polígonos) — ver "Fuente de `inventario_zonas_verdes.geojson`" abajo |
| GET | `/api/arboles/resumen-comuna` | `sau_arboles_urbanos.csv` | Conteo real por comuna, top 5 especies y % de estado fitosanitario (SAU) — agregado liviano para el dashboard |
| GET | `/api/arboles/clusters?cell_size_deg=` | idem | Clustering espacial en grid (centroide + conteo por celda) — para el mapa a zoom alejado |
| GET | `/api/arboles/puntos?min_lon=&min_lat=&max_lon=&max_lat=&limit=` | idem | Árboles individuales reales dentro de un bbox, con tope duro de resultados — para el mapa a zoom cercano |
| GET | `/api/salud/resumen-comuna` | `salud_respiratoria_resumen_comuna.json` + `poblacion_por_comuna.csv` | Diagnósticos CIE-10 J00-J99 por comuna, red pública Metrosalud, con conteo absoluto **y** `tasa_por_1000_hab` — ver "Fuente de `salud_respiratoria_resumen_comuna.json`" abajo. **Respuesta incluye `metodologia` obligatorio** (no es la morbilidad total de la ciudad; el denominador de la tasa es población total, no población atendida por Metrosalud) |

## Reproyección de geometrías

Los GeoJSON fuente (`limite_catastral_de_comun.geojson`,
`zonas_priorizadas_siembra.geojson`) vienen en **EPSG:9377** (MAGNA-SIRGAS /
Colombia Bogotá), no en WGS84 como asumía la especificación original de esta
fase. `app/services/data_loader.py` reproyecta a **EPSG:4326** con
`geopandas.GeoDataFrame.to_crs` antes de servir la respuesta, para que el
frontend y las librerías de mapas de fases futuras reciban lat/lon
estándar directamente.

## Comparador de escenarios AHP: `/api/siembra/ranking-comunas`

Recalcula el ranking de comunas priorizadas con pesos custom para PM2.5,
déficit de mitigadores y área disponible (Fase 4, dashboard analítico) — es
la respuesta directa al riesgo señalado en `RESUMEN_EJECUTIVO.md`: los pesos
del modelo AHP (0.45/0.35/0.20) estaban fijados sin análisis de sensibilidad.

**Fórmula** (idéntica a `bloque2_recomendador_siembra.py`, función
`normalizar()` + cálculo de `score_total`):

```
n_x = (x - min(x)) / (max(x) - min(x))     # Min-Max → [0, 1]; serie constante → 0.5
score_total = peso_pm25·n_pm25 + peso_deficit·n_deficit + peso_area·n_area
ranking = orden descendente por score_total
```

- Los 3 pesos deben sumar 1.0 (tolerancia `1e-6`); si no, responde **422**
  con el detalle exacto de la suma recibida — nunca normaliza en silencio.
- **Población del Min-Max**: `resumen_recomendacion_por_comuna.csv` solo
  persiste comunas con zonas de siembra, pero el script fuente normaliza
  sobre la población de comunas con datos PM2.5 de bloque_1 — un conjunto
  parcialmente distinto (confirmado empíricamente: normalizar solo sobre las
  comunas con ambos datos invierte el orden real del CSV en las posiciones
  3-4). Este endpoint reconstruye esa población desde
  `integracion_v2_pm25_arboles_medellin.csv` (ya cargado por el backend) en
  vez de asumir que coincide con el resumen final. Detalle completo de esta
  reconstrucción, con la evidencia que la respalda, en el docstring de
  `app/services/ahp.py`.
- Comunas con zona pero sin dato PM2.5 (Aranjuez, Buenos Aires, Laureles
  Estadio, San Javier) quedan con `score_total=0` — mismo centinela de "sin
  datos" que usa el CSV fuente (`score_multicriteria=0`, `ranking_prioridad=99`).
- Con los pesos por defecto, el orden resultante reproduce
  `ranking_prioridad` del CSV original.
- No se re-ejecuta el spatial join ni se relee ningún archivo fuera de lo
  que el backend ya expone en otros endpoints.

## Comunas con score AHP pero sin zona de siembra: `scores_ahp_extendido_sin_siembra.csv`

**Añadido 2026-08-18.** `resumen_recomendacion_por_comuna.csv` (pipeline
original) solo lista 11 comunas: las que tienen tanto dato PM2.5 como al
menos una zona verde priorizada para siembra. Al cruzar el inventario REAL de
zonas verdes (`inventario_zonas_verdes.geojson`, GeoMedellín) con las 21
comunas/corregimientos, se identificaron 4 comunas más que SÍ tienen dato
PM2.5 (y por tanto score AHP calculable) pero **0 zonas de siembra viables**
dentro de su polígono en ese inventario: **Santa Cruz, Villa Hermosa,
Corregimiento de San Cristóbal y Corregimiento de Santa Elena**.

- **Script**: `backend/scripts/recalcular_siembra_zonas_verdes_reales.py`
  reimplementa fielmente el Bloque 2 del pipeline original
  (`bloque2_recomendador_siembra.py`: filtro de zonas viables por cobertura
  apta + categoría no excluida + área ≥ 25 m², spatial join a comuna,
  normalización Min-Max y score AHP ponderado 0.45/0.35/0.20) corriéndolo
  sobre las 21 comunas en vez de solo las que ya aparecían en el CSV.
- **Validación cruzada**: para las 7 comunas del CSV original que tienen tanto
  PM2.5 como zona, el recálculo reproduce el score original con diferencia
  máxima **≤ 0.0037** y **0 cambios de ranking** (las otras 4 comunas del CSV
  original — Aranjuez, Buenos Aires, Laureles Estadio, San Javier — no tienen
  PM2.5 y quedan con el mismo centinela `score=0`/`ranking=99`).
- **Persistencia**: el script escribe SOLO las 4 comunas nuevas (con score
  pero sin zona) en `backend/data/scores_ahp_extendido_sin_siembra.csv` — un
  archivo separado y nuevo. **`resumen_recomendacion_por_comuna.csv` nunca se
  sobrescribe** (es la fuente intocable usada por el comparador de
  sensibilidad AHP, ver sección anterior).
- **Endpoint**: `/api/siembra/resumen-comuna` combina ambas fuentes y agrega
  dos campos a cada fila para que el consumidor (frontend) distinga siempre
  el origen del dato, nunca solo por inspección visual del score:
  - `fuente_score`: `"pipeline_original"` (11 comunas) o
    `"recalculo_zonas_verdes_reales"` (4 comunas nuevas).
  - `tiene_zona_siembra`: `true` para las 11 originales, `false` para las 4
    nuevas — estas 4 tienen `n_zonas_disponibles=0`,
    `area_total_disponible_ha=0`, `arboles_a_plantar_total=0` y
    `especie_principal=""` (nunca una especie inventada).
- **`/api/siembra/ranking-comunas`** (comparador de escenarios AHP, ver
  sección anterior) **NO se modificó** y sigue usando exclusivamente
  `load_resumen_recomendacion_comuna()` (las 11 comunas originales,
  comportamiento idéntico al validado en el reporte de sensibilidad).
- **Limitación explícita**: estas 4 comunas tienen prioridad AHP conocida
  (score PM2.5-driven) pero **ningún sitio de siembra concreto identificado**
  con los datos disponibles — no debe interpretarse ni mostrarse como
  equivalente a una recomendación completa.

## PM2.5 interpolado (IDW): `scores_ahp_interpolado_idw.csv`

**Añadido 2026-08-18.** Además de las 4 comunas de la sección anterior, hay 6
comunas/corregimientos sin ninguna estación SIATA real dentro de su polígono
(confirmado con point-in-polygon real sobre `limite_catastral_de_comun.geojson`,
EPSG:9377, contra las 14 estaciones conocidas de `auditoria_estaciones_comunas.csv`
y también contra las ~12 estaciones adicionales de la red metropolitana SIATA
que no están en ese CSV). Se dividieron en dos grupos por distancia real a la
estación más cercana:

- **Popular, Manrique, Doce de Octubre**: 1.5–2.1 km de la estación más
  cercana, en zona urbana continua — interpolación defendible, confianza
  **"media"**. Son las 3 comunas de esta sección.
- **Altavista, San Antonio de Prado, San Sebastián de Palmitas**: 6.6–6.7 km,
  terreno de ladera/rural — **NO se generó ningún número para estas 3**;
  siguen en su estado "sin datos en la fuente" sin ningún cambio. No se debe
  forzar una interpolación cuando la distancia real invalida el supuesto de
  homogeneidad espacial local que sostiene el IDW.

### ⚠️ Este es el dato menos confiable que ha entrado al sistema

El PM2.5 de Popular, Manrique y Doce de Octubre **NO es una medición real**:
es un **estimado por interpolación espacial (IDW)** a partir de estaciones
reales cercanas, no una lectura de ningún sensor dentro de la comuna. El
score AHP de estas 3 comunas hereda esa incertidumbre completa — es una
estimación derivada de una estimación. Se etiqueta explícitamente en cada
capa del sistema (API, mapa, panel de detalle, dashboard) para que nunca se
vea ni se use como equivalente a un dato medido.

### Metodología IDW exacta

Script: `backend/scripts/calcular_pm25_interpolado_idw.py` (solo cálculo +
persistencia en los 3 archivos nuevos listados abajo; nunca toca
`resumen_recomendacion_por_comuna.csv` ni `Solicitud_PM25_DP1763941.csv`).

1. **Centroide real** de cada comuna: `geopandas` calcula el centroide sobre
   el CRS proyectado original del shapefile (EPSG:9377, metros — geométricamente
   correcto), luego se reproyecta a WGS84 solo para el cálculo de distancia.
2. **Valor base por estación**: última lectura horaria no nula de
   `Solicitud_PM25_DP1763941.csv` (misma función que
   `load_estaciones_pm25` en `app/services/data_loader.py`, replicada en
   pandas puro).
3. **Vecinas**: las **4** estaciones SIATA reales (de las 14 conocidas) más
   cercanas al centroide por distancia geodésica (fórmula de Haversine, km).
   No se filtra por comuna asignada (`comuna_por_gis`): solo importa la
   distancia geográfica real.
4. **Peso e interpolación** — IDW clásico con **exponente p=2** (inverso de
   la distancia al cuadrado, no p=1): se eligió p=2 porque penaliza con más
   fuerza la influencia de estaciones lejanas, apropiado dado que ya se
   confirmó que ninguna estación cae realmente dentro de la comuna (se
   prioriza la estación más cercana sobre un suavizado más plano):

   ```
   peso_i = 1 / distancia_i²
   pm25_interpolado = Σ(peso_i · valor_i) / Σ(peso_i)
   ```

5. **Sanity check obligatorio** (el script se detiene con `SystemExit` si
   falla para cualquier comuna): el valor interpolado debe caer dentro de
   `[min, max]` de las 4 estaciones vecinas usadas — propiedad matemática
   garantizada de cualquier promedio ponderado con pesos positivos, así que
   una falla indica un bug real, no ruido de datos.

**Resultado (fecha del cálculo: 2026-08-18, con la última lectura disponible
en `Solicitud_PM25_DP1763941.csv` en ese momento)**:

| Comuna | PM2.5 IDW (µg/m³) | Estaciones usadas | Distancia mínima | Rango vecinas |
|---|---|---|---|---|
| Doce de Octubre | 28.9665 | MED-PBLQ, MED-ARAN, MED-FISC, MED-UNNV | 1.616 km | [27.00, 41.00] |
| Popular | 27.1240 | MED-ARAN, MED-VILL, MED-FISC, MED-PBLQ | 1.357 km | [16.65, 30.00] |
| Manrique | 21.9549 | MED-VILL, MED-ARAN, MED-FISC, CEN-TRAF | 1.452 km | [16.65, 31.00] |

Los 3 sanity checks pasaron (valor IDW dentro del rango de sus vecinas en los
3 casos).

**Limitación explícita adicional**: la estación `MED-UNNV` (usada para Doce de
Octubre) figura como **"Inactiva"** en `auditoria_estaciones_comunas.csv` y su
última lectura disponible es de **2020-02-25** (mucho más antigua que las
demás estaciones, casi todas con lectura de 2026-02-28) — su peso en el IDW es
el más bajo de las 4 (la más lejana), pero igual introduce un dato
desactualizado en el cálculo. Se documenta aquí en vez de excluirla en
silencio: excluirla habría dejado a Doce de Octubre con solo 3 vecinas,
inconsistente con las otras 2 comunas de este grupo.

### Score AHP para estas 3 comunas

Mismos pesos y fórmula que `recalcular_siembra_zonas_verdes_reales.py`
(`W_PM25=0.45, W_DEF=0.35, W_AREA=0.20`, Min-Max + score ponderado), con dos
diferencias:

- `pm25_promedio` = el valor IDW de la tabla anterior (no una lectura real).
- `deficit_pct`/`ratio_mitigadores` se calculan aquí mismo desde el
  inventario arbóreo real (`sau_arboles_urbanos.csv`, filtrado a estas 3
  comunas) cruzado con el catálogo de especies mitigadoras de PM2.5
  (`Visualizacion-de-datos/base_datos_arboles/ARBOLES/Data_Clean/ARBOLES.xlsx`,
  hoja `ESPECIE_REDUCEN`) — la misma fuente y método que usa el script del
  Bloque 1 para las 11 comunas originales, no un método inventado aparte.
- La normalización Min-Max corre **solo sobre estas 3 comunas** (población
  separada, no mezclada con las 11 ni con las 4 de la sección anterior) — por
  eso `ranking_prioridad`/`score_multicriteria` de estas 3 filas **no es
  comparable directamente** con el de las otras 15 comunas con score.
- Las 3 comunas resultaron con `n_zonas_disponibles=0` (mismo patrón que las
  4 comunas de la sección anterior: 0 zonas viables del inventario real de
  zonas verdes dentro de su polígono), confirmado con el mismo spatial join
  (`predicate="within"`) ya usado en `recalcular_siembra_zonas_verdes_reales.py`.

**Persistencia** — 2 archivos nuevos, nunca mezclados con datos reales:

- `backend/data/pm25_interpolado_idw.csv`: solo el resultado IDW crudo
  (comuna, valor, estaciones usadas, distancias, confianza).
- `backend/data/scores_ahp_interpolado_idw.csv`: score AHP completo (mismas
  columnas que `scores_ahp_extendido_sin_siembra.csv`) — **no** se agregó a
  ese archivo porque su nombre significa específicamente "score sin zona de
  siembra pero con PM2.5 medido"; mezclar rompería esa semántica.
- `backend/data/comunas_pm25_interpolado_meta.csv`: metadatos que el loader
  usa para poblar `pm25_confianza`/`pm25_distancia_estacion_mas_cercana_km`
  en la respuesta del API.

**Endpoint**: `/api/siembra/resumen-comuna` agrega estas 3 filas con:

- `fuente_score = "interpolado_idw"` (distinto de `"pipeline_original"` y de
  `"recalculo_zonas_verdes_reales"`).
- `pm25_tipo_dato = "interpolado"` (las demás comunas: `"medido"`).
- `pm25_confianza = "media"` (única confianza usada aquí; `"baja"` está
  reservada para el modelo pero no se usa en ninguna fila actual — ver
  restricción dura de no generar número para Altavista/San Antonio de
  Prado/San Sebastián de Palmitas).
- `pm25_distancia_estacion_mas_cercana_km`: la distancia real calculada
  arriba (1.357/1.452/1.616 km), nunca un placeholder.

`/api/siembra/ranking-comunas` (el comparador AHP) **no se modificó** y sigue
devolviendo exactamente las 11 comunas originales — ver test
`test_ranking_comunas_no_incluye_comunas_sin_zona_de_siembra`.

## Altavista — PM2.5 histórico real, no vigente: `scores_ahp_altavista_historico.csv`

**Integrado: 2026-08-18.**

Investigación en SISAIRE/IDEAM (fuente independiente de SIATA) encontró una
estación de monitoreo de PM2.5 real dentro del polígono de Altavista que no
estaba en el CSV local del proyecto: **MED-ALTA2** ("IE Débora Arango,
Altavista"), operada por **Corantioquia**, activa 2021-10-17 a 2025-09-25
(confirmada por point-in-polygon real contra el límite catastral de la
comuna).

### Metodología

- Se descargó la serie diaria completa de MED-ALTA2 desde SISAIRE
  (`backend/data/raw_sisaire_med_alta2_pm25_diario.csv`, 1.184 filas,
  2021-10-17 a 2025-09-25).
- **Valor representativo usado**: promedio del **último año completo de
  datos antes de la inactivación** (2024-09-25 a 2025-09-25) =
  **14.6834639424498 µg/m³**, con n=249 lecturas diarias de 365 posibles
  (~68% completitud — huecos normales en monitoreo real). Se prefiere sobre
  el promedio de toda la serie de 4 años (18.66 µg/m³, contexto histórico
  únicamente) por ser más representativo del estado reciente de la comuna.
- Persistido en `backend/data/pm25_historico_altavista.csv` (archivo
  separado, nunca mezclado con datos vigentes), con la fecha del último dato
  real (`fecha_ultimo_dato_real=2025-09-25`) visible en el propio archivo.
- Score AHP completo calculado con
  `backend/scripts/calcular_score_ahp_altavista_historico.py`, reutilizando
  la misma lógica Min-Max + combinación ponderada de
  `recalcular_siembra_zonas_verdes_reales.py`: PM2.5 histórico agregado a la
  población de normalización de las 11 comunas originales, y área/zonas
  verdes reales calculadas con el mismo spatial join
  (`predicate="within"`) sobre `inventario_zonas_verdes.geojson`. El
  `deficit_pct`/`ratio_mitigadores` se calculó cruzando el inventario SAU de
  Altavista (3.441 árboles) contra el mismo catálogo de especies mitigadoras
  de PM2.5 (`ARBOLES.xlsx`, hoja `ESPECIE_REDUCEN`) que usa el Bloque 1 para
  las 11 comunas originales.
- Resultado: `n_zonas_disponibles=0` (mismo patrón que las 4 comunas "sin
  zona de siembra"), persistido en
  `backend/data/scores_ahp_altavista_historico.csv`.

### ⚠️ Limitación explícita: dato real pero NO vigente

La estación MED-ALTA2 lleva **~11 meses inactiva** (desde 2025-09-25). Este
PM2.5 es una medición real y directa, pero **no representa necesariamente
las condiciones actuales** de Altavista. Por eso nunca se presenta con la
misma confianza visual que un dato medido vigente (las 11 comunas
originales) ni que uno interpolado (Popular/Manrique/Doce de Octubre): tiene
su propia categoría, un cuarto nivel de confianza.

**Endpoint**: `/api/siembra/resumen-comuna` agrega esta fila con:

- `fuente_score = "historico_no_vigente"` (distinto de `"pipeline_original"`,
  `"recalculo_zonas_verdes_reales"` e `"interpolado_idw"`).
- `pm25_tipo_dato = "historico"` (cuarto valor del `Literal`, junto a
  `"medido"`/`"interpolado"`/`"sin_dato"`).
- `pm25_fecha_ultimo_dato = "2025-09-25"`: para que el frontend muestre
  "activa hasta [fecha]" en vez de un placeholder fijo.

`/api/siembra/ranking-comunas` (el comparador AHP) **no se modificó**.

## Fuente de `inventario_zonas_verdes.geojson`

**Resuelto (2026-08-04).** El script original `bloque2_recomendador_siembra.py`
referenciaba una ruta (`bases_de_datos/base_datos_zonas_verdes/...`) que no
coincidía con ninguna carpeta real del repo de datos, y el archivo nunca
existió en el repo original — por eso el endpoint respondía 503 en fases
anteriores.

Se reemplazó por el inventario real de zonas verdes descargado del portal
oficial de datos abiertos **GeoMedellín** (Alcaldía de Medellín), descargado
el **2026-08-04**. 48.348 polígonos, CRS EPSG:9377, con columnas de detalle
(`tipologia`, `categoria`, `subcategoria`, `cober_dom`, `narb_aprox`,
`cubierta_verde`, `potencial_verde`) más ricas que el esquema placeholder
original — `app/models/zona_verde.py` se actualizó para reflejar los campos
reales (`extra="allow"` para las columnas de detalle por subsistema, casi
siempre "No aplica", que no se tipan una a una).

**Optimización de payload** (`load_inventario_zonas_verdes_geojson` en
`app/services/data_loader.py`): el archivo fuente pesa 71MB sin optimizar,
demasiado para servir sin degradar el framerate del mapa con la capa activa.
Se aplican tres pasos antes de servir la respuesta (cacheados vía
`lru_cache`, un único costo de carga/proceso ~20s en el primer request):

1. `geopandas.GeoDataFrame.geometry.simplify(tolerance=0.5, preserve_topology=True)`
   en el CRS proyectado original (metros): ~44% menos vértices, <0.12% de
   distorsión de área total (medido comparando área agregada antes/después).
2. `shapely.set_precision(grid_size=1e-6)` tras reproyectar a WGS84 (~0.11m
   de resolución): trunca el ruido decimal de los flotantes.
3. Se descartan en la respuesta las columnas de detalle por subsistema
   (`ap_*`, `so_*`, `ree_*`, `sh_*`) que no se usan para colorear ni en el
   popup del mapa.

Resultado: 71MB → ~23MB servidos, endpoint responde **200**.

Si en el futuro se necesita más rendimiento (p. ej. paginación espacial por
bounding box del viewport), evaluarlo después de medir el impacto real de
esta simplificación a solas — no antes.

## Fuente de `sau_arboles_urbanos.csv`

Inventario real de árboles del **Sistema de Árbol Urbano (SAU)**, Alcaldía de
Medellín — no es el mismo dataset que `base_datos_arboles` del pipeline
original (bloque_1/bloque_2), que sigue alimentando exclusivamente el modelo
AHP de recomendación de siembra (`app/services/ahp.py`). Esta fuente es para
enriquecer visualización y KPIs informativos del dashboard/mapa; no se mezcló
con el pipeline de recomendación.

**Descubrimiento**: el visor público https://www.medellin.gov.co/sau/
consulta, sin autenticación, un servicio ArcGIS REST propio de la Alcaldía
(`servidormapas`, no el AMVA como se sospechaba inicialmente) — confirmado
inspeccionando la pestaña Network del navegador. `?f=json` en la raíz del
servicio no declara ningún término de uso/licencia (`copyrightText` vacío);
es infraestructura pública sin restricción documentada.

- **Servicio**: `https://www.medellin.gov.co/servidormapas/rest/services/ambiente_dllo_sost/VA_SistemaArbolUrbano_Ciudadano/MapServer/1` (capa "Arbol Urbano").
- **Descargado**: 2026-08-12, con `backend/scripts/fetch_sau_arboles.py`.
- **Método**: paginado (`resultOffset`/`resultRecordCount=2000`, tope real
  del servicio), throttled a 1 request/segundo (~170 requests, obligatorio —
  es un servicio público compartido, no una API comercial), con reintentos
  ante fallos de red puntuales y deduplicación por `objectid`.
- **Volumen**: 339.724 árboles reales (`returnCountOnly` del servicio,
  confirmado contra el conteo final descargado — el script imprime y
  compara ambos al terminar).
- **Formato de almacenamiento**: CSV (no GeoJSON) con 13 columnas —
  `s_especie`, `nombre_comun`, `tipoarbol`, `s_estado_arbol`,
  `s_estado_individuo`, `municipio`, `comuna`, `barrio`, `fecha_ingreso`,
  `fecha_actualizacion`, `lon`/`lat` (WGS84, ya reproyectadas desde el
  EPSG:3116 nativo del servicio) y `objectid`/`id_individuo_disperso`. Se
  eligió CSV sobre GeoJSON porque a este volumen (339k filas) el overhead de
  estructura GeoJSON (`type`/`geometry`/`properties` por feature) infla el
  archivo sin necesidad — un CSV con columnas `lon`/`lat` planas es
  suficiente para las agregaciones de `app/services/arboles.py` y mucho más
  compacto.

**Ningún endpoint expone los 339.724 puntos crudos en una sola respuesta**
(mismo problema de framerate que ya se vio con zonas verdes, 48.348
polígonos, pero aquí el volumen es ~7x mayor):

1. `/api/arboles/resumen-comuna`: agregados por comuna (conteo, top 5
   especies, % de estado fitosanitario) — decenas de filas, no cientos de
   miles.
2. `/api/arboles/clusters`: grid espacial (`cell_size_deg`, por defecto
   ~0.01° ≈ 1.1km) — el número de celdas depende del área cubierta, no de la
   densidad real de árboles, así que el payload se mantiene pequeño sin
   importar cuántos árboles haya.
3. `/api/arboles/puntos`: puntos individuales reales, pero acotados a un
   `bbox` explícito (viewport actual del mapa) y con un tope duro de 3.000
   resultados por request (`truncado=true` en la respuesta si el viewport
   tiene más).

Este diseño se decidió **antes** de implementar la capa del mapa (a
diferencia de zonas verdes, donde la paginación espacial quedó pendiente como
optimización futura tras detectar el problema de framerate) — ver la sección
correspondiente en `ecodata-lab-frontend/README.md` o en los componentes de
`src/components/map/layers/arbolesSauLayer.ts`.

## Fuente de `salud_respiratoria_resumen_comuna.json`

Resumen agregado (no crudo) de diagnósticos respiratorios por comuna, para
enriquecer el dashboard con un indicador de salud pública — fuente
independiente tanto del pipeline original (bloque_1/bloque_2, que sigue
alimentando exclusivamente el modelo AHP) como del inventario del SAU.

**Descubrimiento**: exploración de portales de datos abiertos (MEData de la
Alcaldía tiene el "Tablero de datos - Secretaría de Salud" en
`medata.gov.co/node/8080`, pero es un dashboard Power BI embebido sin datos
exportables, y además el sitio tiene un certificado SSL vencido — confirmado
con dos herramientas distintas). El dataset real y descargable se encontró en
el portal nacional **datos.gov.co**: **"Perfil de morbilidad de la ESE
Metrosalud"** (`https://www.datos.gov.co/Salud-y-Protecci-n-Social/Perfil-de-morbilidad-de-la-ESE-Metrosalud/pypc-7h3w`,
dataset id `pypc-7h3w`), publicado por la propia Metrosalud (red pública de
salud de Medellín) vía API Socrata (SoQL).

- **Consultado**: 2026-08-12, con `backend/scripts/fetch_salud_respiratoria.py`.
- **Método**: 3 consultas SoQL agregadas del lado del servidor (`$select`/`$where`/`$group`)
  — total por comuna, desglose por año, y top 5 diagnósticos CIE-10 por
  comuna — **nunca** se descargan las >1.048.575 filas crudas de atenciones
  individuales del dataset fuente. Sin App Token de Socrata (uso puntual y de
  bajo volumen, 3 requests); si en el futuro se refresca con frecuencia,
  registrar uno gratis en https://dev.socrata.com/docs/app-tokens.
- **Filtro aplicado**: `codigo_diagnostico_principal LIKE 'J%'` (CIE-10
  J00-J99, enfermedades del sistema respiratorio).
- **Granularidad**: `comuna` (coincide con los nombres usados en el resto del
  proyecto) y `barrio`/lat-lon de barrio en el dataset fuente, aunque este
  resumen solo persiste el nivel comuna.
- **Rango temporal**: 2024-01-01 a 2026-04-21 en el dataset fuente (dataset
  activo, actualizado por última vez 2026-07-23 según metadata de Socrata) —
  **se solapa solo parcialmente** con la ventana PM2.5 del proyecto
  (2023-2025); no asumir correspondencia temporal exacta entre ambos
  indicadores en ningún cruce visual.
- **Actualización recomendada**: dado que el dataset fuente se actualiza
  activamente, re-ejecutar `backend/scripts/fetch_salud_respiratoria.py`
  cada 1-3 meses sería razonable para mantener el resumen al día; no hay
  automatización de esto todavía (ejecución manual).

**Sesgo metodológico (no opcional, documentado en 3 lugares — este README,
el campo `metodologia` de la respuesta del endpoint, y el disclaimer visible
en el frontend)**: Metrosalud es la red **pública/régimen subsidiado** de
Medellín — no cubre pacientes de EPS del régimen contributivo atendidos en
clínicas privadas. El sesgo hacia comunas de menor estrato (San Javier,
Robledo, Manrique con más diagnósticos; El Poblado, Laureles con menos)
refleja composición de la población atendida por esta red específica, **no**
necesariamente mayor incidencia real de enfermedad. Es un proxy válido de
"carga respiratoria en la red pública", nunca "morbilidad respiratoria total
de la ciudad" — ningún texto de la UI debe presentarlo como tal.

`app/models/salud_respiratoria.py` define `metodologia: str` como campo
**obligatorio** (no `| None`) en `ResumenSaludRespiratoriaResponse`: es
imposible deserializar la respuesta del endpoint sin recibir también este
caveat.

## Fuente de `poblacion_por_comuna.csv`

Proyecciones de población por comuna/corregimiento, para calcular densidad
poblacional y normalizar la carga de morbilidad respiratoria de Metrosalud
(tasa por 1.000 hab., ver arriba).

- **Fuente**: DANE, vía Alcaldía de Medellín — "Proyecciones de población por
  Comunas y Corregimientos 2018-2030, Actualización Año 2025" (Contrato
  interadministrativo No. 4600104690 de 2025, DANE - Municipio de Medellín).
  Descargado como `.xlsx` desde
  `https://www.medellin.gov.co/es/centro-documental/proyecciones-poblacion-viviendas-y-hogares/`
  (dominio principal `medellin.gov.co`, no `medata.gov.co` — ese subdominio
  tenía el certificado SSL vencido, mismo hallazgo que con el dataset de
  salud respiratoria).
- **Descargado**: 2026-08-14.
- **Procesado por**: `backend/scripts/procesar_poblacion_comunas.py` — lee la
  hoja única `"Comunas y Corregimientos"` del Excel (header real en la fila
  16, filas 1-15 son metadata/título), descarta la fila `"Totales"` y las
  notas al pie, y agrupa (`groupby`) por `Nombre Comuna` sumando la columna
  del año elegido: los corregimientos 60/70/80/90 vienen con **dos filas**
  cada uno en el Excel fuente (una para `"Cabecera Municipal"` y otra para
  `"Centros Poblados y Rural Disperso"`) que hay que sumar para obtener la
  población total del corregimiento. Resultado: 21 filas (16 comunas + 5
  corregimientos), población total ~2.52M, consistente con la cifra pública
  conocida de Medellín.
- **Año elegido: 2024**, de la serie 2018-2030 disponible. El dataset no
  distingue explícitamente qué años son "observados" vs. "proyectados" (el
  título dice "proyecciones" para toda la serie 2018-2030, recalibrada con la
  actualización DANE de julio de 2025); se eligió 2024 por ser el año más
  reciente de la serie que no es una proyección lejana hacia el futuro,
  dentro de la ventana de solapamiento con los datos de PM2.5 (2023-2025) y
  de salud respiratoria (2024-2026) del resto del proyecto. Cambiar el año
  significa editar `ANIO_ELEGIDO` en el script y re-ejecutarlo.
- **`area_km2`/`densidad_hab_km2`**: calculadas en `app/services/data_loader.py`
  a partir de la geometría de `limite_catastral_de_comun.geojson`, en su CRS
  proyectado original (EPSG:9377, unidades = metros) antes de reproyectar —
  el área en grados de WGS84 no es interpretable directamente.

## Cruce de comunas

El proyecto cruza comunas por **nombre normalizado** (mayúsculas, sin
tildes — ver `app/services/comuna_join.py` en el backend y
`ecodata-lab-frontend/src/lib/map/matchComuna.ts` en el frontend, mismo
algoritmo espejado en ambos lenguajes), no por el código numérico DANE /
Decreto 346 de 2000. Ese código (`"01"`..`"16"`, `"50"`, `"60"`, `"70"`,
`"80"`, `"90"`) solo existe hoy en `limite_catastral_de_comun.geojson`
(`properties.comuna`) y en `poblacion_por_comuna.csv` (`codigo_comuna`,
expuesto como dato de referencia); ningún otro dataset del proyecto lo trae.

**Decisión tomada en esta integración (población)**: se evaluó migrar el
cruce completo del proyecto a código DANE, ya que es más robusto que el
cruce por texto (evita mantener una tabla de alias manual para casos como
"LAURELES ESTADIO" → "LAURELES" o "Corregimiento de San Cristóbal" →
"SAN CRISTOBAL"). Se decidió **no hacerlo** en este prompt: el cruce por
nombre normalizado ya está en uso en ~7 archivos del frontend (capas del
mapa en deck.gl, selectores por teclado, el comparador de comunas, el panel
de detalle) más su test unitario, y migrarlo tocaría piezas ya estables del
proyecto en el mismo cambio que introduce el dataset de población — un
riesgo innecesario para el alcance de este prompt. En su lugar, el nuevo
dataset de población se integró con el mismo mecanismo de nombre
normalizado ya existente, extendiendo `matchComuna.ts`/`comuna_join.py` con
dos piezas que hacían falta y que además arreglan un bug real preexistente:
strip del prefijo `"CORREGIMIENTO DE "` (sin esto, `ComunaDetailPanel` nunca
lograba cruzar los datos de salud respiratoria de los 5 corregimientos con
la comuna seleccionada en el mapa) y el alias `"SAN SEBASTIAN DE PALMITAS"`
→ `"PALMITAS"`.

**Pendiente técnico documentado** (ver también `docs/ESTADO_PROYECTO.md`):
migrar el cruce completo del proyecto (backend y frontend) de nombre
normalizado a código DANE, como mejora de robustez separada. Valdría la
pena porque: (1) elimina la necesidad de mantener tablas de alias a mano
cada vez que aparece una fuente nueva con una variante de texto distinta
para el mismo nombre; (2) es inmune a cambios de mayúsculas/tildes/prefijos
en fuentes futuras; (3) ya existe el código en el geojson catastral, solo
faltaría que los demás datasets (siembra, salud, población) lo expusieran
también. El costo es tocar ~7 archivos de frontend estables (incluida su
cobertura de tests) más los loaders del backend, en un cambio que no es
urgente porque el cruce actual, aunque menos robusto, funciona correctamente
para las 21 comunas/corregimientos existentes.

## Manejo de errores

Si cualquier `DATA_*` apunta a un archivo inexistente, el endpoint
correspondiente responde `503` (no `500`) con un mensaje que indica
exactamente qué variable de entorno revisar — nunca una traza genérica.

## Deploy

`backend/` es autocontenida: los datasets que lee viven en `backend/data/`
(copiados ahí desde `Visualizacion-de-datos/` al organizar el monorepo para
deploy — ya no se leen con rutas `../Visualizacion-de-datos/...`), así que no
hace falta ningún volumen externo ni empaquetar nada por fuera de esta
carpeta. Root Directory a configurar en la plataforma: **`backend`**.

1. **Render (usado en este proyecto, plan Free)**: configuración versionada en
   `render.yaml` (raíz del repo) — build nativo de Python, sin Dockerfile.
   `geopandas>=1.0` usa `pyogrio` (no `fiona`), y `pyogrio`/`shapely`/`pyproj`
   traen GDAL/GEOS/PROJ empaquetados en sus wheels de Linux, así que no hace
   falta ninguna dependencia de sistema adicional en el build de Render —
   verificado revisando `pip show geopandas` (`Requires: numpy, packaging,
   pandas, pyogrio, pyproj, shapely`, sin `fiona`) antes de asumir que un
   Dockerfile custom era necesario.
   - **Root Directory**: `backend`.
   - **Build Command**: `pip install -r requirements.txt`.
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   - **Health Check Path**: `/health`.
   - Variables de entorno: las mismas `DATA_*` de `.env.example` (ya apuntan
     a `./data/...`) + `CORS_ALLOWED_ORIGINS` con la URL del frontend
     desplegado en Vercel + `SENTRY_DSN` (proyecto "Python/FastAPI" en
     [Sentry](https://sentry.io), monitoreo de errores en producción — sin
     este valor, Sentry simplemente no se inicializa).
     **`render.yaml` NO se actualiza solo** cuando se agrega un campo
     obligatorio (sin default) a `Settings` en `app/core/config.py` — ver
     incidente documentado en `docs/ESTADO_PROYECTO.md` (2026-08-18:
     `DATA_SAU_ARBOLES_URBANOS`, `DATA_SALUD_RESPIRATORIA_RESUMEN_COMUNA` y
     `DATA_POBLACION_POR_COMUNA` se agregaron a `Settings`/`.env` local en
     integraciones sucesivas pero nunca a `render.yaml`, y Render solo lo
     reveló al fallar `Settings()` con `ValidationError` en el arranque —
     404 en producción, no un crash visible). Antes de dar por cerrada
     cualquier integración que agregue un campo `Path` obligatorio a
     `Settings`, diff `render.yaml` contra `.env.example` explícitamente.
   - **Trade-off del plan Free**: el servicio se duerme tras 15 minutos sin
     tráfico; el primer request tras dormir tarda ~30-50s (cold start) en
     responder mientras el contenedor arranca. Es una decisión consciente de
     costo para una demo de bajo tráfico, mitigada en el frontend con un
     mensaje de carga explícito para esperas largas — ver
     `docs/ESTADO_PROYECTO.md`.
2. **Railway**: mismo start command/variables que Render; requiere plan de
   pago si ya se usó el proyecto gratuito de prueba en esa cuenta (limitación
   de cuenta, no del código — por eso este proyecto usa Render).
3. **Docker simple**: si en algún momento Render dejara de bastar (por
   ejemplo, si una versión futura de alguna dependencia sí requiriera GDAL de
   sistema), un `Dockerfile` mínimo con Python 3.11+, `pip install -r
   requirements.txt` y `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0",
   "--port", "8000"]` despliega igual en Render/Railway/Fly.io o cualquier
   host con soporte de contenedores.

En cualquier caso, actualizar `CORS_ALLOWED_ORIGINS` con la URL del frontend
ya desplegado (ver `ecodata-lab-frontend/README.md` → sección Deploy).

## CORS

`app/main.py` permite explícitamente `http://localhost:3000` (configurable
vía `CORS_ALLOWED_ORIGINS`, separado por comas). Para producción, agrega el
dominio del frontend desplegado a esa variable — ver el comentario en
`app/main.py`.
