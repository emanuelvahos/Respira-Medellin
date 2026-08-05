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

## Endpoints

| Método | Ruta | Fuente | Descripción |
|---|---|---|---|
| GET | `/api/comunas` | `limite_catastral_de_comun.geojson` | Límite catastral de comunas + corregimientos (GeoJSON, WGS84) |
| GET | `/api/comunas/{nombre}` | idem | Filtra por nombre de comuna |
| GET | `/api/comunas/estaciones/auditoria` | `auditoria_estaciones_comunas.csv` | Trazabilidad estación SIATA → comuna |
| GET | `/api/pm25?comuna=&anio=` | `integracion_v2_pm25_arboles_medellin.csv` | PM2.5 × cobertura arbórea por comuna/periodo |
| GET | `/api/pm25/relaciones-anuales?comuna=&anio=` | `relaciones_v2_bloque2.csv` | Relaciones anuales comuna × vulnerabilidad |
| GET | `/api/pm25/estaciones` | `Solicitud_PM25_DP1763941.csv` + `auditoria_estaciones_comunas.csv` | Última lectura real de PM2.5 por estación SIATA (no agregada por comuna); pensado para capas que necesitan variación espacial genuina, p. ej. partículas animadas |
| GET | `/api/siembra/zonas?comuna=` | `recomendacion_siembra_por_zona.csv` | Recomendación de siembra por zona (~1.649 filas) |
| GET | `/api/siembra/zonas/geojson` | `zonas_priorizadas_siembra.geojson` | Geometría de zonas priorizadas (GeoJSON, WGS84) |
| GET | `/api/siembra/resumen-comuna` | `resumen_recomendacion_por_comuna.csv` | Score AHP y ranking agregado por comuna |
| GET | `/api/siembra/ranking-comunas?peso_pm25=&peso_deficit=&peso_area=` | recalculado (ver abajo) | Ranking AHP con pesos custom (comparador de escenarios, Fase 4) |
| GET | `/api/zonas-verdes` | `inventario_zonas_verdes.geojson` | Inventario real de zonas verdes (48.348 polígonos) — ver "Fuente de `inventario_zonas_verdes.geojson`" abajo |

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
     desplegado en Vercel.
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
