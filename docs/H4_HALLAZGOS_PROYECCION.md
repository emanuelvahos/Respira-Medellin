# H4 — Hallazgos para una proyección robusta (borrador para revisar)

Estado: **investigación, sin código cambiado**. Las cifras salen de lecturas automáticas de las fuentes; **antes de citarlas en un documento formal hay que confirmarlas contra el PDF original** (en particular los cuartiles de mortalidad).

## 1. Qué tiene hoy la proyección (F4, `maduracion.py`)
- Tres escenarios (optimista/esperado/conservador) y una curva logística de maduración por especie, con caveats honestos.
- **Le falta:** (a) supervivencia: asume que todo árbol plantado sobrevive; (b) incertidumbre de la remoción de PM2.5 por árbol; (c) un ancla de calibración con datos de Medellín.

## 2. Parámetros con fuente encontrados
| Parámetro | Valor | Fuente |
|---|---|---|
| Mortalidad anual, fase de establecimiento (≤5 años) | mediana 6,6-7 %/año; rango intercuartil aprox. 2,8-9,3 % | [Roman et al., revisión "Urban Tree Mortality: A Literature Review", Arboriculture & Urban Forestry 45(5)](https://auf.isa-arbor.com/content/45/5/167) |
| Mortalidad anual, post-establecimiento (>5 años) | mediana 2,8-3,8 %/año | misma revisión |
| Árboles de calle (inventarios repetidos) | mediana ≈2,5 %/año; rango 0-68,5 % | misma revisión |
| Remoción neta de PM2.5 por área de copa | 0,13-0,36 g/m²/año (diez ciudades de EE. UU.) | [Nowak et al. 2013](https://www.fs.usda.gov/nrs/pubs/jrnl/2013/nrs_2013_nowak_002.pdf) |
| Resuspensión de partículas | ≈34 % de lo interceptado vuelve al aire (27-43 %) | Nowak et al. 2013 |
| Valle de Aburrá: bosque urbano | ≈688.000 árboles, 23,3 % de cobertura; remoción PM2.5 ≈32,1 t/año (1,73 % de las emisiones del valle) | [Arroyave-Maya et al. 2019](https://www.fs.usda.gov/nrs/pubs/jrnl/2019/nrs_2019_arroyave-maya_001.pdf) |
| Medellín: efecto marginal de más vegetación | +1 % cobertura ≈ +1 % remoción; ubicar árboles en zonas más contaminadas ≈ +1,6 % | [Estimación del efecto marginal... Medellín (Zenodo)](https://zenodo.org/records/3873612) |

## 3. Hallazgos que importan
1. **Los estudios locales no coinciden en la magnitud:** la remoción de PM2.5 para el Valle va de ≈32 t/año (Arroyave-Maya 2019) a ≈83 t/año para el área metropolitana y ≈3 t/año solo para Medellín (estudio Zenodo). Cualquier cifra de "toneladas de PM2.5 removidas" debe mostrarse como **rango**, no como un número.
2. **El efecto es pequeño frente a las emisiones** (≈1,7 % de las emisiones del valle con todo el bosque urbano actual). Prometer reducciones grandes de PM2.5 con siembra sería indefendible; el mensaje honesto es "aporte complementario, mayor si se siembra donde hay más contaminación", lo cual **respalda el AHP** (prioriza PM2.5).
3. **Falta supervivencia en la proyección.** Con las mortalidades de la revisión, de 100 árboles plantados sobreviven aprox. (cálculo propio, a verificar): optimista 87/76/59 a los 5/10/20 años; esperado 71/62/46; conservador 61/51/34. Esto reduciría el efecto proyectado de forma material y es el cambio más valioso.
4. **El inventario SAU permite una verificación local parcial:** 14,8 % de los 507.730 individuos únicos figuran talados, desaparecidos o muertos (75.216), pero sin fecha de siembra no se puede convertir en tasa anual. Sirve como contraste de orden de magnitud, no como parámetro.

## 4. Propuesta (para decidir contigo)
- Añadir un factor de **supervivencia** por escenario (mortalidad de establecimiento ≤5 años y posterior) y multiplicarlo con el de maduración existente.
- Mostrar la remoción de PM2.5 como **rango** apoyado en las dos referencias del Valle/Medellín, con la resuspensión (≈34 %) declarada.
- Etiquetar en la interfaz cada parámetro como "citado" o "supuesto".
- No tocar la curva de maduración hasta tener DAP/edad reales del SAU.

## 5. Límites de esta investigación
Lectura automática de resúmenes de papers: confirmar cifras contra los originales; los parámetros son de otros contextos climáticos (mayormente EE. UU.), no de Medellín; no se evaluó supervivencia específica de las 5 especies recomendadas.
