# H3 — Evidencia satelital (NDVI Sentinel-2)

**Qué es:** NDVI mediano por comuna (Sentinel-2 L2A, Copernicus, vía Microsoft Planetary Computer), periodo 2025-10-11 a 2026-10-06, 59 fechas sin nube, 20 m. Script: `backend/scripts/calcular_ndvi_comunas.py` (requiere internet; se corrió en GitHub Actions). Salida: `backend/data/ndvi_por_comuna.csv` y `ndvi_meta.json`. Endpoint: `GET /api/arboles/ndvi`.

**Resultado:** en las 16 comunas urbanas, la correlación de Spearman entre NDVI y árboles SAU por km² es 0,54 y por 1.000 habitantes 0,53 (moderada, positiva). Santa Cruz, Doce de Octubre y Candelaria tienen el verdor más bajo; El Poblado y Robledo el más alto entre las urbanas.

**Qué NO prueba:** el NDVI incluye pastos, cultivos y bosque, no solo árboles del SAU; no mide captura de PM2.5; con 16 puntos la correlación es descriptiva. Los corregimientos se separan por su bosque rural. Úsese como evidencia complementaria de cobertura vegetal, nunca como prueba de impacto.

**Refresco:** repetir el script (p. ej. cada año) y reemplazar los dos archivos.
