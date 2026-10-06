<documento nombre="Auditoría del frontend, EcoData Lab Medellín" fecha="2026-10-06">

<metodo>
Revisión de código de `ecodata-lab-frontend` (Next 16, Tailwind 4, shadcn, framer-motion + GSAP) con los criterios de cinco skills: Apple Design (respuesta, interrupción, materiales, tipografía), Mobile-native (capa de plataforma en móvil), UI/UX Pro Max (accesibilidad, táctil, rendimiento, navegación, datos), Design Taste (solo la landing, que es lo que cubre) y Animate-Expo (**no aplica**: es para React Native; solo se usó su filtro "¿debe animarse?").
Límite honesto: es una auditoría de código, no de pantallas renderizadas (en este entorno no cargan las fuentes de Google, así que no pude capturar el sitio). Todo lo marcado "verificar en teléfono" requiere un dispositivo real. Los hallazgos son hipótesis fundadas en el código, no mediciones.
</metodo>

<lo_que_ya_esta_bien>
- Foco visible en enlaces y botones; `aria-label` en 22 sitios; iconos decorativos con `aria-hidden`.
- `prefers-reduced-motion` centralizado en un hook (`usePrefersReducedMotion`) y respetado en GSAP.
- Mapa con `100dvh`, skeletons que reservan altura (disciplina de CLS), estado con icono + texto (no solo color) en las tarjetas nuevas.
- Dos temas con tokens semánticos y `oklch`; `tabular-nums` en las tablas nuevas.
- Tailwind 4 ya aplica `hover:` solo en dispositivos con hover, por lo que el "hover pegado" en móvil no es un problema aquí.
</lo_que_ya_esta_bien>

<hallazgos prioridad="de mayor a menor impacto">

<hallazgo id="F1" prioridad="alta" skill="UI/UX Pro Max (táctil, CRÍTICO) + Mobile-native">
**Objetivos táctiles menores a 44 px.** `Button` por defecto mide `h-8` (32 px), `icon` `size-8`, `xs` `h-6` (24 px). Los botones de cerrar de `ComunaDetailPanel` y `ZonaSiembraDetailPanel` usan `p-1` (~24 px); los botones flotantes de la landing `size-9` (36 px); los enlaces del menú móvil son texto `text-sm` sin relleno.
Arreglo: en táctil, ampliar sin cambiar el diseño de escritorio, con la variante `pointer-coarse:` de Tailwind 4 (`pointer-coarse:h-11`, `pointer-coarse:size-11`) o una zona extra con `after:absolute after:-inset-2`; dar `py-2` a los enlaces del menú móvil. Mantener ≥ 8 px entre objetivos.
Esfuerzo: 1-2 h. Verificar en teléfono.
</hallazgo>

<hallazgo id="F2" prioridad="alta" skill="Mobile-native">
**Falta la capa base de plataforma.** No hay export `viewport` ni `theme-color` en `layout.tsx`, ni `-webkit-tap-highlight-color`, `touch-action: manipulation`, `overscroll-behavior` ni `env(safe-area-inset-*)` en el CSS.
Efecto probable: destello gris al tocar, barra de estado que no coincide con el tema, retraso de toque en algunos elementos, y paneles fijos (`fixed top-16 bottom-0 right-0`) que pueden quedar bajo la barra de gestos en iPhone.
Arreglo: `export const viewport = { themeColor: [{media:"(prefers-color-scheme: light)", color:"<fondo claro>"},{media:"(prefers-color-scheme: dark)", color:"<fondo oscuro>"}], viewportFit:"cover" }`; en `globals.css`: `html{-webkit-tap-highlight-color:transparent}`, `button,a,[role=button]{touch-action:manipulation}`, `overscroll-behavior:contain` en los paneles con scroll propio, y `padding-bottom: env(safe-area-inset-bottom)` en los paneles fijos.
Esfuerzo: 1 h. Verificar en teléfono real (emulación no lo reproduce).
</hallazgo>

<hallazgo id="F3" prioridad="alta" skill="UI/UX Pro Max (navegación) + Design Taste (jerarquía)">
**El dashboard creció a ~12 bloques en una sola columna** (KPI, SAU, salud, comparaciones, árboles por comuna, NDVI, AHP v1 vs v2, comparador, proyección, calidad…). Es completo pero obliga a un scroll largo sin orientación, y el mensaje principal queda enterrado. Para vender a un público no técnico es el cambio de mayor retorno.
Arreglo: (a) bloque de arranque "qué dice el dato en 3 frases" con la comuna prioritaria, el total de árboles y la fecha de corte; (b) índice de secciones con anclas (Resumen, Árboles, Prioridad, Evidencia, Proyección, Calidad) fijo en escritorio y como pestañas desplazables en móvil; (c) secciones secundarias plegadas por defecto.
Esfuerzo: 4-6 h. Mantener los skeletons con la misma altura para no romper CLS.
</hallazgo>

<hallazgo id="F4" prioridad="media" skill="UI/UX Pro Max (datos) + Mobile-native">
**Tablas densas en móvil.** Mis dos tablas nuevas tienen 6-8 columnas; hoy dependen de scroll horizontal. Legible pero no cómodo con el pulgar.
Arreglo: columna "Comuna" fija (`sticky left-0 bg-card`) y, bajo `sm`, vista de tarjeta por comuna con 3 datos clave (árboles por 1.000 hab., % mitigadoras, posición). Ordenar por columna como ya hace `ComunasTable`.
Esfuerzo: 3 h.
</hallazgo>

<hallazgo id="F5" prioridad="media" skill="Design Taste + Apple Design (confianza visual)">
**La credibilidad de los datos debe verse sin buscarla.** Con H5 ya existe el panel de calidad, pero está al final. Falta una insignia "Datos al <fecha>" cerca del título del dashboard que enlace a `#calidad-datos`, y un rótulo de estado (medido / interpolado / histórico / sin dato) consistente en mapa, tabla y panel de comuna. Es lo que distingue un producto defendible ante una Alcaldía de un tablero bonito.
Esfuerzo: 2 h.
</hallazgo>

<hallazgo id="F6" prioridad="media" skill="Design Taste (solo landing) + Apple Design">
**Movimiento: dos librerías en el mismo árbol.** `HomeClient` usa GSAP (`ScrollSection`, `ScrollMapSync`) y framer-motion (`AHPBalanceBar`). Design Taste desaconseja mezclarlas (pelean por los frames) y pide que cada animación tenga un motivo. Aquí el scroll que mueve la cámara del mapa sí comunica (narra la historia); revisar si `AHPBalanceBar` justifica traer framer-motion solo para una barra (una transición CSS basta). Quitarla reduce el paquete.
`ScrollSection` usa `min-h-screen`: pasar a `min-h-dvh` (barra de URL móvil).
Esfuerzo: 1-2 h. Medir el tamaño del bundle antes y después.
</hallazgo>

<hallazgo id="F7" prioridad="baja" skill="Apple Design (materiales)">
**Transparencia sin alternativa.** El `Header` usa `backdrop-blur` con fondo semitransparente; no hay respaldo para `prefers-reduced-transparency` ni `prefers-contrast: more`. Añadir un bloque `@media (prefers-reduced-transparency: reduce){ header{background:var(--background);backdrop-filter:none} }`. En los paneles laterales, una transición con resorte interrumpible (ahora `transition-transform duration-300 ease-out`) mejoraría la sensación, pero no lo priorizaría: el panel se abre pocas veces por sesión, así que la animación actual es suficiente.
</hallazgo>

<hallazgo id="F8" prioridad="baja" skill="Design Taste (juicio, no norma)">
**Tipografía.** Inter + Fraunces es la combinación que la skill marca como "por defecto de modelos". Para un producto ambiental/cívico, una serif de títulos puede ser coherente con la intención, así que no lo trataría como defecto; sí conviene decidirlo a propósito. Si se quiere una identidad más propia: títulos con una sans de carácter y mantener Fraunces solo en cifras grandes. Es decisión de marca, no de corrección.
También: la plantilla de título `%s — Eco…` y cadenas visibles con raya larga; la regla de Design Taste que las prohíbe es para landings. Si se adopta, cambiar por guion o dos puntos en `layout.tsx` y en los textos visibles de la landing.
</hallazgo>

<hallazgo id="F9" prioridad="baja" skill="UI/UX Pro Max (gráficos)">
**Gráficos:** confirmar que cada gráfico tiene resumen textual para lector de pantalla (`aria-label` con la conclusión) y alternativa en tabla (ya existe en varias). Las barras de NDVI usan solo longitud + número, correcto; evitar rojo/verde como único diferenciador.
</hallazgo>

</hallazgos>

<no_aplica>
- Animate-Expo: no hay React Native. Su "puerta de frecuencia" sí aplica: no animar nada que el usuario vea decenas de veces al día (cambios de pestaña, filtros). Hoy el proyecto cumple.
- Design Taste: la mayor parte (hero, bento, logos de clientes, eyebrows) es para landings y portafolios. Solo se aplicaría a `/` y `/presentacion`; el dashboard es producto de datos y se rige por UI/UX Pro Max.
</no_aplica>

<plan_sugerido orden="por retorno/esfuerzo">
1. F2 + F1 (plataforma y táctil): medio día, mejora inmediata en teléfono.
2. F5 (insignia de fecha y rótulos de estado): 2 h, refuerza la venta de calidad de datos.
3. F3 (resumen inicial + índice): 4-6 h, el cambio más visible para clientes.
4. F4 (tablas en móvil) y F6 (movimiento): según tiempo.
Antes y después de F1-F3: correr Lighthouse móvil y probar en un teléfono real de gama media; ese es el criterio de aceptación, no el emulador.
</plan_sugerido>

</documento>
