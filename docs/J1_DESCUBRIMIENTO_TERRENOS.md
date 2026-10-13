# J1 — Descubrimiento de fuentes de terreno, suelo y redes (Medellín)

<metadatos>
fecha: 2026-10-13
fase: J1 (descubrimiento) del esfuerzo "terrenos de siembra con datos más exactos"
método: recorrido automático (GitHub Actions) del servidor ArcGIS de la Alcaldía + 2 consultas de valores + lectura del Plan Distrital de Silvicultura Urbana 2025-2036
alcance: solo descubrimiento. No se cambió ningún dato ni cálculo del producto.
evidencia cruda: docs/j1/ (inventario, distribuciones, DEM/redes, geoportales)
</metadatos>

<resumen>
**Veredicto.** Hay más datos abiertos de lo esperado, y alcanzan para un filtro de aptitud por zona (nivel 1) y para puntos indicativos de siembra (nivel 2). No alcanzan para validar en campo (nivel 3).

**Se pudo verificar con consulta real:**
- Relieve: modelo de elevación de 1 m (2024) y 5 m, y pendiente en grados a 10 m. Responden por punto en El Poblado, Centro y Robledo.
- Amenaza por movimiento en masa, inundación y avenida torrencial. Actualizadas entre abril y julio de 2026.
- Riesgo (alto riesgo mitigable / no mitigable) y geología (31 unidades).
- Andenes: 42.965 tramos con ancho, estado, obstáculos y material.
- Postes (46.445) y luminarias (166.962) de alumbrado público.
- Líneas eléctricas de transmisión (934 polígonos de influencia, con distancia de afectación de 10 a 32 m).
- Redes de servicios (alcantarillado, acueducto, gas y energía; 14.629 tramos), pero a escala de ordenamiento y con fecha 2014.
- Espacios verdes urbanos (194.916 polígonos, con cobertura, propiedad y rango de árboles).
- Retiros a quebradas (10 a 60 m).

**No hay (o no es abierto):**
- Redes domiciliarias o de detalle (profundidad, diámetro actual). La capa de redes es de 2014 y de escala POT.
- Un estudio de suelos agronómico (textura, pH, compactación) con cobertura urbana. El Plan de Silvicultura lo lista como investigación pendiente.
- Datos de IGAC y EPM: ambos servidores no respondieron desde GitHub (tiempo agotado / sin conexión). Falta reintentar o pedirlos.

**Hallazgo clave del Plan de Silvicultura.** El Plan reconoce que no existe una guía oficial de «criterios de selección de especies según las condiciones del sitio» y la deja como investigación pendiente. También deja pendiente estimar la supervivencia de los árboles plantados (prioridad alta). Por eso nuestro «porqué esa especie» debe presentarse como criterio propio, documentado y sujeto a revisión técnica, no como norma oficial.
</resumen>

<fuentes_verificadas>
Todas son de `https://www.medellin.gov.co/servidormapas/rest/services/`. «Verificado» = se consultó y devolvió datos.

| Tema | Capa (ruta) | Contenido verificado | Corte | Uso propuesto |
|---|---|---|---|---|
| Elevación | `ServiciosImagen/Modelo_digital_de_elevacion_medellin_2024/ImageServer` | Pixel 1 m, F32, rango 1.144–3.141 m. Poblado 1.582,6 m; Centro 1.472,9 m | 2024 (nombre) | Altitud por punto |
| Elevación | `.../Modelo_digital_de_elevacion_Medellin` | Pixel 5 m | sin dato | Respaldo |
| Pendiente | `.../Modelo_digital_de_pendiente_gr_AMVA/ImageServer` | Grados, 0–78,9 (media 20,8). Poblado 11,0°; Centro 1,6°; Robledo 8,9° | sin dato | Descartar zonas muy inclinadas |
| Mov. en masa | `ambiente_dllo_sost/VA_DGRD/MapServer/6` | 2.376 polígonos: Alta 984, Media 1.134, Baja 257, Muy baja 1 | 2026-04-30 | Excluir amenaza alta |
| Inundación | `.../VA_DGRD/MapServer/5` | 716: Alta 137, Media 259, Baja 123, Muy baja 197 | 2026-04-30 | Aviso/restricción |
| Avenida torrencial | `.../VA_DGRD/MapServer/4` | 115: Alta 31, Media 32, Baja 52 | 2026-04 a 2026-07 | Aviso/restricción |
| Riesgo | `.../VA_DGRD/MapServer/9` | 736: alto mitigable 162, alto no mitigable 140, con condiciones 215, medio 115, bajo 104 | 2025-12 a 2026-07 | Excluir alto riesgo |
| Geología | `ambiente_dllo_sost/VM_DAGRD/MapServer/0` | 2.588 polígonos, 31 unidades (Qll 1.494, Qd 465…) con descripción | sin dato | Contexto geotécnico (no es suelo agronómico) |
| Andenes | `mapas_nacionales/VC_Infraestructura_Fisica/MapServer/0` | 42.965 tramos: ancho (media 1,67 m), estado, material, obstáculos | sin dato | Ancho disponible en arbolado de calle |
| Postes | `vivienda_ciudad_terri/VM_Alumbrado_Publico/MapServer/1` | 46.445 (46.294 en operación; altura 4–26 m) | sin dato | Evitar conflicto |
| Luminarias | `.../VM_Alumbrado_Publico/MapServer/0` | 166.962 puntos | sin dato | Evitar conflicto |
| Líneas de tensión | `ambiente_dllo_sost/VA_SistemaArbolUrbano_Contrato/MapServer/6` | 934 polígonos de influencia (110 kV: 822; 220–230 kV: 112); `buff_dist` 10–32 m | sin dato | Excluir franja de seguridad |
| Redes de servicios | `ordenamiento_ter/VM_15_Subs_Servicios_Publicos/MapServer/7` | 14.629 tramos: alcantarillado (colectores, interceptores), acueducto (agua potable/cruda), gas y energía. Longitud total 1.894 km | **2014-12-17** | Aviso de posible interferencia; no sustituye el plano EPM |
| Espacios verdes (SAU) | `ambiente_dllo_sost/VA_SistemaArbolUrbano_Base/MapServer/5` | 194.916 polígonos: cobertura (pasto 132.405; árboles 32.228; tierra 7.359; arbustos 8.069), propiedad (público 43.140; fiscal 8.091), clase funcional, `narb_aprox` (Rango 1: 180.392) | 2016–2019 (según `fuente_inf`) | Contraste con nuestro inventario de zonas verdes |
| Retiros a quebradas | `ordenamiento_ter/VM_04_Estructura_Ecologica_Principal/MapServer/8` | 1.289 polígonos; faja de 10, 15, 20, 25, 30 y 60 m | sin dato | Excluir retiro |
| Uso del suelo | `ordenamiento_ter/VA_POT48_Reporte_UsoSuelo_U/MapServer/20` | 25.446 polígonos (espacio público existente 5.496, proyectado 1.026…) | 2014-12-17 | Contexto |
| Curvas de nivel | `mapas_nacionales/VC_Relieve/MapServer/0` y `Hosted/COTAS5M` | Curvas urbanas y cada 5 m | sin dato | Alternativa al DEM |

Método de consulta validado: consulta espacial por punto o por caja en EPSG:9377 (MAGNA Medellín). Un punto en El Poblado devolvió amenaza baja por movimiento en masa y geología NQFII (flujos de escombros). Las consultas devuelven como máximo 2.000 registros por llamada; para toda la ciudad se descargan por páginas.
</fuentes_verificadas>

<no_resueltas>
1. **IGAC (agrología) y EPM (geoportal ArcGIS):** sin respuesta desde el entorno de ejecución. No quiere decir que no existan datos. Hay que reintentar o buscar el catálogo por otra vía.
2. **Suelo agronómico:** no apareció una capa de textura, pH o compactación para el área urbana. El Plan de Silvicultura lista «Requerimientos nutricionales de los árboles urbanos» y «Evaluación de los factores abióticos» como investigación pendiente. La geología sirve como contexto geotécnico, no como aptitud de suelo para un árbol.
3. **Datos abiertos nacionales:** las búsquedas en datos.gov.co no devolvieron conjuntos de alcantarillado, acueducto, arbolado ni suelos para Medellín. El catálogo ArcGIS Hub devolvió error 400.
4. **Gas y energía de distribución:** la capa trae redes de transmisión de energía y redes de gas, pero a escala de ordenamiento. No trae el detalle de calle. Los operadores solo entregan eso con una solicitud por obra.
5. **Fechas de corte** de varias capas no se publican. Se registrarán como «sin fecha de corte» en el registro de fuentes.
</no_resueltas>

<plan_silvicultura>
Fuente: Plan Distrital de Silvicultura Urbana para Medellín (PDF oficial, 3,5 MB, descargado y leído).
- Reconoce conflictos con redes: «los árboles entran en conflicto con edificios, cables eléctricos y vías, lo que lleva a una poda excesiva o a la remoción».
- Habla de plantar «de acuerdo a las características tipológicas de forma, tamaño y distancia de siembra recomendada, así como el suelo, las posibles restricciones y potencialidades de cada sitio», sin dar una tabla de criterios.
- Agenda de investigación (Tabla 22): «Criterios de selección de las especies según las condiciones del sitio» (prioridad media); «Estimación de la supervivencia/mortalidad de los árboles plantados» (alta); «Selección de especies resistentes al cambio climático» (alta).
- Remite al Manual de Silvicultura Urbana (Decreto 895 de 2018) y a las fichas de especies del portal de la Alcaldía. Esas fichas son la fuente natural para sustentar el «porqué esa especie».
- Propone la regla 3-30-300 (300 m a un espacio verde).
</plan_silvicultura>

<implicaciones>
- **Nivel 1, aptitud por zona (factible ya):** por zona se calcula pendiente (DEM/pendiente), amenaza, riesgo, retiro a quebrada, franja de línea de tensión y ancho de andén. Resultado: apta / apta con condiciones / no apta, con el motivo.
- **Nivel 2, puntos indicativos (factible):** se necesitan postes, luminarias, andenes y redes para descartar puntos. La capa de redes es de 2014, por eso cada punto lleva «sujeto a visita técnica y concepto de EPM».
- **Nivel 3, validación en campo:** no es posible con datos abiertos.
- **Especie:** el porqué parte de nuestra regla por tipología más las fichas botánicas existentes (`fichas_especies.json`), con ancho disponible, altura de postes/líneas y pendiente como restricciones. Se debe etiquetar como criterio propio.
- **Mensaje honesto en la interfaz:** «Se consultaron redes de servicios públicos a escala de ordenamiento (2014). No se verificaron redes de detalle. Requiere concepto de interferencia antes de sembrar.»
- **Reuso y venta:** la licencia de reutilización de estas capas no se ha revisado. Antes de vender hay que confirmar los términos de datos abiertos de la Alcaldía (como ya está anotado para el archivo PM2.5).
</implicaciones>

<riesgos>
| Riesgo | Efecto | Mitigación |
|---|---|---|
| Redes de 2014 | Se sugiere un punto donde hoy hay una red nueva | Etiqueta de «verificar», no presentar como libre de interferencias |
| Capas sin fecha de corte | No se puede afirmar vigencia | Registrar «sin fecha» en `/api/calidad-datos` |
| DEM/pendiente a 10 m | Pendiente promedia el entorno y no sirve para alcorques individuales | Usar DEM de 1 m para el punto |
| Servidor municipal no estable ni con garantía | Caída del servicio | Descargar y versionar un corte propio (con fecha y hash) |
| Sobreprometer | Pérdida de confianza si un punto resulta inviable | Mostrar solo el nivel 1 en público al inicio |
</riesgos>

<siguientes_pasos>
1. Descargar por páginas y versionar las capas elegidas (pendiente, amenaza, riesgo, retiros, líneas de tensión, andenes, postes, redes), con fecha de corte y hash.
2. Calcular la aptitud por zona (nivel 1) y contrastarla contra una muestra de zonas a mano.
3. Decidir si el nivel 2 se muestra en público o solo el nivel 1 (decisión del usuario).
4. Registro de fuentes y reglas de calidad (extender `/api/calidad-datos`).
5. Reintentar IGAC y EPM, o solicitarlos formalmente.
</siguientes_pasos>
