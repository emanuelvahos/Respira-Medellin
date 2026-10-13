# J2 — Aptitud del terreno por zona y puntos indicativos de siembra

<metadatos>
fecha: 2026-10-13
fase: J2 (nivel 1 y nivel 2 construidos juntos; el nivel 2 se publica detrás de un interruptor)
script: backend/scripts/calcular_aptitud_terreno.py (necesita internet; se ejecuta en GitHub Actions)
datos generados: backend/data/aptitud_terreno_por_zona.csv, puntos_indicativos_siembra.geojson, capas_terreno_manifest.json
api: GET /api/siembra/zona/{id}/aptitud, /api/siembra/aptitud/resumen, /api/siembra/puntos-indicativos (apagado)
fuentes y hallazgos previos: docs/J1_DESCUBRIMIENTO_TERRENOS.md
</metadatos>

<resultado>
Consulta del 2026-10-13 sobre las 1.648 zonas de siembra:
- Aptas: 949. Aptas con condiciones: 623. No aptas: 76 (65 por estar bajo franja de línea de tensión, 11 por alto riesgo no mitigable).
- Puntos indicativos generados: 3.132 (en 1.274 zonas). 374 zonas quedan con 0 puntos: 76 no aptas y 298 donde no cabe un árbol respetando margen, postes, redes y árboles existentes.
- El cupo previo (estimado solo por área) sumaba 8.798 árboles. El nuevo número es menor porque ahora se exigen margen de borde, distancia a postes y redes, y no pisar árboles ya inventariados. Para hablar de cuántos árboles caben, el número vigente es el de los puntos, no el del cupo por área.
- Pendiente: el mosaico de 10 m cubre el 100 % del área, con media 8,2° y percentil 95 de 26,8°. Solo 5 zonas tienen pendiente media ≥ 20°.
</resultado>

<reglas_nivel_1>
Todas son criterio propio de EcoData Lab, no norma oficial. Se definen como constantes en el script.
| Condición | Resultado |
|---|---|
| Pendiente media ≥ 35° | No apta |
| Pendiente media 20–35° | Con condiciones (terrazas) |
| Riesgo alto no mitigable en ≥ 50 % de la zona | No apta |
| Riesgo alto mitigable o con condiciones en ≥ 5 % | Con condiciones (concepto DAGRD) |
| Amenaza alta por movimiento en masa en ≥ 50 % y pendiente ≥ 25° | No apta |
| Amenaza alta por movimiento en masa en ≥ 5 % | Con condiciones |
| Amenaza alta por inundación o avenida torrencial en ≥ 5 % | Con condiciones (especies tolerantes) |
| Retiro a quebrada en ≥ 5 % | Con condiciones (nativas riparias, autorización ambiental) |
| Franja de línea de tensión en ≥ 60 % | No apta |
| Franja de línea de tensión en ≥ 5 % | Con condiciones (no sembrar bajo la línea) |
| Redes de servicios a ≤ 5 m de la zona | Con condiciones (concepto de EPM) |
</reglas_nivel_1>

<reglas_nivel_2>
- Rejilla hexagonal con la separación mínima de la especie, dentro de la zona con 1 m de margen de borde. Se prueban 4 desplazamientos y se conserva el que deja más puntos.
- Se descartan puntos a menos de 3 m de un poste, a menos de 2 m de redes de agua (alcantarillado y acueducto), a menos de 3 m de redes de gas o energía, dentro de la franja de tensión, o a menos de la mitad de la separación de un árbol del SAU ya inventariado.
- El número de puntos nunca supera el cupo previo.
- Cada punto es INDICATIVO: «sujeto a visita técnica y concepto de EPM». La interfaz lo dice en el panel de la zona.
</reglas_nivel_2>

<publicacion>
El nivel 2 está apagado: `PUNTOS_INDICATIVOS_PUBLICOS=false` (valor por defecto). Con el interruptor apagado, el endpoint de puntos devuelve 404, el resumen y el panel muestran 0 puntos, y el mapa no dibuja nada. El nivel 1 (aptitud, motivos, condiciones, datos y «por qué esta especie») se muestra siempre en el panel de la zona.
Para encenderlo hay que poner `PUNTOS_INDICATIVOS_PUBLICOS=true` en el backend (Render) y reiniciar. Es una decisión del dueño del proyecto.
</publicacion>

<limites>
1. Las redes de servicios son del POT (2014) y de escala de ordenamiento: son un aviso, no un plano de interferencias.
2. La pendiente es de 10 m. Promedia el entorno y no ve alcorques individuales. El DEM de 1 m (2024) queda para una mejora.
3. Varias capas no publican fecha de corte. Amenaza y riesgo son de 2026.
4. Los umbrales son criterio propio y no se han contrastado con un experto en silvicultura. Antes de usarlos en un contrato, revisarlos con la Secretaría de Medio Ambiente o un técnico forestal.
5. No hay datos de suelo agronómico. «Por qué esta especie» se apoya en la regla por tipología y la ficha botánica.
6. Las capas de la Alcaldía dependen de su servidor. Cada ejecución guarda en `capas_terreno_manifest.json` la fecha, el número de registros y un hash de geometrías por capa.
7. La reutilización y reventa de estas capas no se ha revisado.
</limites>

<como_actualizar>
1. Ejecutar `python scripts/calcular_aptitud_terreno.py --salida data` desde `backend/` en un entorno con internet (en este proyecto, un workflow de GitHub Actions temporal).
2. Revisar el resumen impreso y el manifiesto: ninguna capa debe quedar en `no_disponible`.
3. Correr las pruebas del backend y abrir un PR con los tres archivos de `data/`.
</como_actualizar>
