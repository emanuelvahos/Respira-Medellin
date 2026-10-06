# AHP v2 — déficit de especies mitigadoras sobre el SAU actual (2026-10-06)

## Qué es
El mismo modelo AHP del proyecto (0,45 · PM2.5 + 0,35 · déficit de especies mitigadoras
+ 0,20 · área apta, Min-Max a [0,1]) pero con el conteo de árboles tomado del SAU
vigente (ver `H1_VERIFICACION_SAU.md`) en lugar del Excel antiguo del pipeline original.
**El v1 no se modifica** (`/api/siembra/ranking-comunas`, `resumen_recomendacion_por_comuna.csv`
y `zonas_priorizadas_siembra.geojson` siguen intactos). El v2 se sirve en paralelo en
`/api/siembra/ahp-v2` y `/api/siembra/ahp-v2/resumen`, y se compara en el dashboard.

Se genera con `backend/scripts/calcular_ahp_v2_sau.py` (sin red; usa solo archivos del repo).

## Qué cambia y qué no
- Cambia: árboles totales y mitigadores por comuna (SAU: árboles vivos de Medellín).
- No cambia: PM2.5 (misma fuente y valor), área apta, pesos, benchmark de 30 %, las 5
  especies mitigadoras (Zygia longifolia, Calliandra haematocephala, Bauhinia picta,
  Retrophyllum rospigliosii, Inga densiflora, coincidencia exacta de `s_especie`).

## Hallazgo sobre el inventario del v1
El modelo original usa 42.941 árboles en las 11 comunas originales (el valor se repite
por periodo en `integracion_v2_pm25_arboles_medellin.csv`; no son 3 veces más). El SAU
vigente registra 300.341 árboles vivos en esas mismas comunas (~7×) y 431.908 en toda Medellín.

## Resultados (población de las 11 comunas originales, comparación directa)
- 4 de las 5 comunas prioritarias coinciden (v1: Guayabal, Belén, Castilla, La Candelaria,
  El Poblado; v2: La Candelaria, Belén, Guayabal, La América, Castilla).
- Correlación de posiciones (Spearman) v1 vs v2: 0,64.
- Mayores cambios: El Poblado baja 5 posiciones (5 → 10; su % de mitigadoras sube de 1,9 %
  a 5,1 % con el inventario completo); La América sube 6 (10 → 4).
- Versión ampliada (`score_v2_15`): las 15 comunas con algún dato PM2.5, cada una con su
  nivel de confianza (medido, interpolado IDW, histórico). Las 6 sin PM2.5 (Aranjuez,
  Buenos Aires, Laureles Estadio, San Javier, San Antonio de Prado, San Sebastián de
  Palmitas) no reciben score — no se fuerza un número — pero sí sus conteos de árboles.

## Limitaciones declaradas
- El déficit v2 varía poco entre comunas (19,5–27,5 %; casi todas entre 24 y 27 %): el
  Min-Max amplifica diferencias pequeñas. Ver `VALIDACION_SENSIBILIDAD_AHP.md`.
- Las "especies mitigadoras" son la lista del pipeline original; coincidencia solo por
  nombre científico exacto (no incluye otras especies de los mismos géneros).
- El área apta y las zonas de siembra siguen viniendo del pipeline original.
- No hay confirmación institucional del estatus de la capa SAU usada.
