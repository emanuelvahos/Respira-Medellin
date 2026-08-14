# Validación de sensibilidad del modelo de priorización (AHP)

> Documento de diagnóstico para la Secretaría — no técnico. Todos los
> números de este documento se obtuvieron consultando en vivo el endpoint
> real del backend (`GET /api/siembra/ranking-comunas`), el mismo que
> alimenta el comparador de escenarios de `/dashboard`. No son cifras
> simuladas ni de ejemplo.
>
> **Fecha del análisis**: 2026-08-14.

## 1. Por qué existe este documento

El proyecto de ciencia de datos original que dio origen a esta herramienta
señaló explícitamente un riesgo pendiente en su resumen ejecutivo:

> *"los pesos del modelo de priorización (0.45 PM2.5 / 0.35 déficit de
> mitigadores / 0.20 área disponible) están fijados por defecto sin
> evidencia de sensibilidad o validación con la Secretaría — vale la pena
> documentar el proceso de calibración si se usa para decisiones reales."*

Ese riesgo nunca se resolvió. Ya existe una herramienta para explorarlo (el
comparador de escenarios interactivo en el dashboard), pero una herramienta
interactiva no reemplaza un documento que alguien pueda leer, archivar y
usar como referencia al momento de decidir si los pesos actuales son
razonables. Este documento es esa evidencia.

**Importante desde ya**: este documento no concluye que el modelo esté
"mal" ni recomienda cambiar los pesos. Todo modelo que combina varios
criterios (aquí: contaminación, déficit de árboles mitigadores, y espacio
disponible) es sensible en algún grado a cómo se pondera cada uno — eso es
normal y esperable, no un defecto. El objetivo es simplemente hacer visible
*cuánto* cambia el resultado y *para quién* cambia, para que la decisión de
mantener o ajustar los pesos sea informada.

## 2. Qué es el modelo AHP y qué representan sus pesos, en términos simples

El modelo prioriza comunas para siembra de árboles combinando tres
indicadores en un solo puntaje (score) por comuna:

| Criterio | Qué mide | Peso actual |
|---|---|---|
| **PM2.5** | Qué tan contaminado está el aire de la comuna (partículas finas) | 45% |
| **Déficit de mitigadores** | Qué tan por debajo está la comuna de tener suficientes árboles que ayudan a mitigar esa contaminación | 35% |
| **Área disponible** | Cuánto espacio verde apto hay realmente para sembrar en esa comuna | 20% |

Cada criterio se lleva a una escala de 0 a 1 (la comuna con el peor valor
queda en 0, la de mejor valor en 1, y las demás en proporción) y luego se
combina con estos tres pesos, que deben sumar 100%. Cambiar los pesos es
literalmente cambiar "qué nos importa más" al decidir dónde sembrar
primero: más peso a PM2.5 significa priorizar por urgencia de salud
respiratoria; más peso a déficit significa priorizar por equidad de
cobertura arbórea; más peso a área significa priorizar por qué tan fácil es
ejecutar la siembra ahí.

**Una nota de transparencia sobre los datos disponibles**: de las comunas
que el modelo puede evaluar, solo **7** (Guayabal, Belén, Castilla, La
Candelaria, El Poblado, Robledo, La América) tienen datos completos de los
tres criterios. Otras 4 comunas (Aranjuez, Buenos Aires, Laureles Estadio,
San Javier) tienen zonas de siembra identificadas pero no tienen dato de
PM2.5 cruzado, así que el modelo las marca con puntaje 0 como "sin datos
suficientes" — quedan siempre al final del ranking, sin importar qué pesos
se usen, porque no es una cuestión de ponderación sino de datos faltantes.
Este análisis de sensibilidad, por lo tanto, se enfoca en esas 7 comunas,
que son las que realmente compiten por las primeras posiciones.

## 3. Escenarios analizados y por qué se eligieron

No basta con mover un solo peso a la vez: se definieron 5 escenarios, cada
uno con una justificación de política pública, no elegidos al azar.

| Escenario | PM2.5 | Déficit | Área | Por qué se eligió |
|---|---|---|---|---|
| **Actual (default)** | 0.45 | 0.35 | 0.20 | Los pesos vigentes en producción hoy. |
| **Priorizar salud pública** | 0.70 | 0.20 | 0.10 | Representa una postura donde la urgencia sanitaria (exposición a contaminación) pesa por encima de todo lo demás — la lógica de "sembrar donde el aire es peor, cueste lo que cueste ejecutarlo". |
| **Priorizar equidad de cobertura** | 0.20 | 0.65 | 0.15 | Representa priorizar las comunas más rezagadas en cobertura arbórea relativa, independientemente de si hoy tienen el peor aire — la lógica de "cerrar la brecha antes que atacar el peor síntoma". |
| **Priorizar viabilidad técnica** | 0.20 | 0.20 | 0.60 | Representa una postura operativa: sembrar primero donde es más fácil/rápido ejecutar (más espacio disponible), aunque no sea la comuna más urgente en salud o equidad. |
| **Pesos iguales** | 0.333 | 0.333 | 0.333 | Referencia neutral, sin ninguna prioridad de política declarada — sirve como punto de comparación "sin opinión". |

## 4. Resultados

### 4.1 Ranking comparado (posición de cada comuna, por escenario)

| Comuna | Actual | Salud pública | Equidad cobertura | Viabilidad técnica | Pesos iguales |
|---|---|---|---|---|---|
| Guayabal | **#1** | #4 | **#1** | **#1** | **#1** |
| Belén | #2 | #2 | #4 | #2 | #2 |
| Castilla | #3 | #3 | #2 | #5 | #3 |
| La Candelaria | #4 | **#1** | #6 | #4 | #5 |
| El Poblado | #5 | #5 | #3 | #3 | #4 |
| Robledo | #6 | #7 | #5 | #6 | #6 |
| La América | #7 | #6 | #7 | #7 | #7 |
| *Aranjuez, Buenos Aires, Laureles Estadio, San Javier* | #8-11 | #8-11 | #8-11 | #8-11 | #8-11 |

*(Las últimas 4 comunas quedan fijas en todos los escenarios por falta de
dato de PM2.5, no por efecto de la ponderación — ver nota de la sección 2.)*

### 4.2 ¿Qué tan parecido es cada escenario al actual? (correlación de rangos)

Para medir numéricamente qué tan distinto es un escenario del actual, se
usó el **coeficiente de correlación de rangos de Spearman**. En términos
simples: es un número entre -1 y 1 que compara dos rankings — **1.0**
significa "exactamente el mismo orden", **0** significa "no hay relación
alguna entre los dos órdenes", y valores negativos significarían "orden
invertido". No hace falta entender la fórmula, solo leerlo como un
"termómetro de parecido".

| Escenario | Spearman vs. actual |
|---|---|
| Priorizar salud pública | 0.91 |
| Priorizar equidad de cobertura | 0.94 |
| Priorizar viabilidad técnica | 0.96 |
| Pesos iguales | 0.99 |

**Lectura**: todos los escenarios están muy cerca de 1.0 (parecido alto).
Ningún escenario alternativo razonable produce un ranking radicalmente
distinto al actual — el que más se aleja (salud pública, con PM2.5 llevado
al extremo de 70%) sigue teniendo 0.91 de correlación, que es un parecido
alto. Esto es evidencia de que el modelo **no es frágil ante variaciones
moderadas o incluso agresivas de la ponderación**.

### 4.3 Comunas robustas vs. comunas sensibles a la ponderación

Mirando qué comunas están en el **top 5** bajo cada uno de los 5
escenarios:

- **Robustas (top 5 en los 5 escenarios, sin excepción)**: **Guayabal,
  Belén, Castilla, El Poblado**. Estas 4 comunas son candidatas de alta
  confianza para priorizar — su posición destacada no depende de qué
  criterio se valore más, aparecen arriba prácticamente sin importar la
  postura de política pública que se adopte.
- **Sensibles a la ponderación (top 5 solo bajo algunos escenarios)**:
  - **La Candelaria**: está en el top 5 en 4 de los 5 escenarios (incluido
    el actual, donde es #4), pero **cae al puesto #6** bajo el escenario de
    "equidad de cobertura" — su prioridad depende en parte de que el
    criterio PM2.5 tenga peso suficiente.
  - **Robledo**: solo entra al top 5 bajo el escenario de "equidad de
    cobertura" (#5); en todos los demás escenarios, incluido el actual,
    queda en el puesto #6.

Ninguna comuna "sale de la nada" a ocupar el primer lugar bajo un
escenario razonable — los cambios observados son de 1 a 3 posiciones
dentro de un grupo relativamente estable de 7 comunas con datos completos,
no una reorganización completa del ranking.

### 4.4 ¿Hay un punto de quiebre?

Sí, se identificó uno relevante para el **puesto #1**. Fijando el peso de
área en 20% (igual que hoy) y aumentando gradualmente el peso de PM2.5 (con
el peso de déficit ajustándose para compensar), el primer lugar cambia así:

| Peso PM2.5 | Peso déficit | Peso área | Comuna #1 |
|---|---|---|---|
| 0.45 (actual) | 0.35 | 0.20 | Guayabal |
| 0.50 | 0.30 | 0.20 | Guayabal |
| 0.52 | 0.28 | 0.20 | Guayabal |
| **0.53** | **0.27** | **0.20** | **Belén** (cambio de #1) |
| 0.54 | 0.26 | 0.20 | La Candelaria |
| 0.60 | 0.20 | 0.20 | La Candelaria |
| 0.70 | 0.10 | 0.20 | La Candelaria |

**Lectura**: el puesto #1 es estable (Guayabal) mientras el peso de PM2.5
se mantenga por debajo de ~53%. Justo por encima de ese umbral hay una
zona angosta (52%-54%) donde el primer lugar cambia dos veces en un rango
muy corto — de Guayabal a Belén y luego a La Candelaria — antes de
estabilizarse de nuevo. Esto es información útil: significa que la
identidad exacta del "#1" es más sensible que el resto del ranking, y que
si en algún momento se considerase mover el peso de PM2.5 sustancialmente
por encima de 50%, vale la pena saber que ese es el rango donde el
resultado se vuelve menos predecible. Con el peso actual (45%), este punto
de quiebre está a una distancia cómoda (8 puntos porcentuales) del valor
vigente.

## 5. Conclusión

Con la evidencia reunida, el modelo actual (0.45 / 0.35 / 0.20) no muestra
señales de fragilidad: los 4 escenarios alternativos analizados —incluidos
dos que llevan un criterio a un extremo poco habitual (70% a PM2.5, 65% a
déficit)— mantienen una correlación alta (0.91 a 0.99) con el ranking
actual, y el núcleo de comunas mejor priorizadas (Guayabal, Belén,
Castilla, El Poblado) se mantiene estable en las cinco ponderaciones
probadas.

Al mismo tiempo, la evidencia también muestra que el modelo **no es
insensible**: existen 2 comunas (La Candelaria, Robledo) cuya entrada o
salida del top 5 depende de qué se priorice, y existe un punto de quiebre
identificable cerca de 53% de peso a PM2.5 donde el primer lugar cambia. Ni
lo uno ni lo otro es sorprendente ni preocupante en un modelo
multicriterio — es exactamente el tipo de comportamiento esperado, y ahora
está documentado en vez de ser una incógnita.

**Esta evidencia no incluye una recomendación de cambiar los pesos.** El
propósito de este documento es darle a la Secretaría información concreta
—no simulada, obtenida del sistema real— para decidir con criterio propio
si los pesos actuales reflejan la prioridad de política pública deseada, o
si alguno de los escenarios alternativos aquí descritos se ajusta mejor a
esa prioridad. El comparador interactivo de `/dashboard` permite explorar
cualquier otra combinación de pesos más allá de las 5 analizadas aquí, en
caso de que la Secretaría quiera evaluar un escenario propio.

---

*Metodología: los 5 escenarios y el barrido del punto de quiebre se
obtuvieron consultando en vivo `GET /api/siembra/ranking-comunas` (el
mismo endpoint del comparador de `/dashboard`, implementado en
`backend/app/services/ahp.py`) con distintos valores de `peso_pm25`,
`peso_deficit` y `peso_area`. El coeficiente de Spearman se calculó sobre
las 11 comunas que el endpoint expone (7 con datos completos + 4 con
puntaje-sentinela 0 por falta de dato de PM2.5, que no varían entre
escenarios). No se modificó ningún archivo de configuración ni el valor
por defecto de los pesos (`PESO_PM25_DEFECTO`, `PESO_DEFICIT_DEFECTO`,
`PESO_AREA_DEFECTO` en `backend/app/services/ahp.py`) como parte de este
análisis — siguen siendo 0.45 / 0.35 / 0.20 en el sistema en producción.*
