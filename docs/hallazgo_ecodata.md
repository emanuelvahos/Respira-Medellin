# EcoData Lab — Hallazgo para Hackathon de Datos 2026

<config>
Categoría: Interna · Modalidad: Visualización · Temática: Desarrollo sostenible y ambiente
Producto: https://ecodata-lab-frontend.vercel.app/mapa
</config>

<pregunta>
¿Dónde conviene sembrar primero en Medellín para reducir la exposición a PM2.5 y cerrar la brecha de arbolado, y qué tan confiable es esa priorización?
</pregunta>

<hallazgo_principal>
Las comunas del nororiente tienen muy poco arbolado por habitante: Santa Cruz 21,5, Popular 25,8 y Manrique 27,7 árboles vivos por 1.000 hab., frente a 506,7 en El Poblado (hasta 23,6 veces más) y 171,1 en promedio de ciudad.
Doce de Octubre (29,0 µg/m³) y Popular (27,1 µg/m³) son las más expuestas a PM2.5 y quedan primero y segundo en el ranking de prioridad (score AHP con PM2.5 45 %, déficit de mitigadores 35 %, área disponible 20 %).
</hallazgo_principal>

<hallazgos_de_apoyo>
- 6 de 21 comunas y corregimientos no tienen dato de PM2.5 (Aranjuez, Buenos Aires, Laureles Estadio, San Javier, San Antonio de Prado, Palmitas): 684.628 personas, el 27,1 % de la población.
- Las dos comunas prioritarias (Doce de Octubre y Popular) tienen PM2.5 interpolado (confianza media), no medido, y 0 zonas de siembra identificadas: el plan actual no las cubre.
- NDVI satelital coincide: Santa Cruz, Doce de Octubre, Candelaria, Popular y Manrique están entre las 5 de menor vegetación.
</hallazgos_de_apoyo>

<propuesta_de_mejora>
1. Priorizar la siembra en Doce de Octubre y Popular, previo inventario de zonas plantables (hoy 0).
2. Instalar o ampliar estaciones PM2.5 en las 6 comunas sin dato, empezando por las de mayor población (Buenos Aires, San Javier, Aranjuez).
3. Reemplazar PM2.5 interpolado por medido en las comunas prioritarias antes de invertir.
</propuesta_de_mejora>

<limitaciones_honestas>
- PM2.5 interpolado (IDW) en 3 comunas; el déficit v2 varía poco entre comunas (19–27 %), y la sensibilidad del ranking está en docs/VALIDACION_SENSIBILIDAD_AHP.md.
- Salud respiratoria es solo red Metrosalud, no toda la ciudad.
</limitaciones_honestas>

<medata>
Dataset: Mortalidad, Secretaría de Salud de Medellín — https://medata.app.medellin.gov.co/dataset/1-026-22-000161
Licencia: CC BY 4.0 según la ficha del portal (el metadato JSON dice CC BY-SA 4.0: citar "CC BY(-SA) 4.0").
Uso: 18.445 muertes respiratorias 2017-2021 (26.888 en 2012-2021) por comuna de residencia, suma de 3 subcategorías OPS: crónicas de vías respiratorias inferiores, infecciones respiratorias agudas y resto del sistema respiratorio.
Resultado honesto: la tasa cruda NO sigue el patrón de exposición. Más alta en La Candelaria (285 por 100 mil hab./año) y Laureles (232); Doce de Octubre 123 y Popular 110. Spearman con PM2.5 = 0,44 (n = 15, no concluyente) y con árboles/1.000 hab. = +0,23. Tasa cruda sin ajustar por edad (las comunas más envejecidas pesan más): no es causal.
Frase para el tablero: "MEData muestra dónde se concentra la mortalidad respiratoria, pero sin ajustar por edad no permite atribuirla al aire ni al arbolado."
</medata>

<fuentes>
SAU (medellin.gov.co), SIATA, Metrosalud (datos.gov.co), DANE, límites GeoMedellín y MEData (Mortalidad).
</fuentes>
