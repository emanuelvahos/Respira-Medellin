# Automatización de Lighthouse (CLI, sin DevTools ni extensión)

> Patrón reutilizable: correr Lighthouse contra un build de producción local
> desde terminal, con Chrome headless, sin depender de que una pestaña tenga
> foco ni de abrir manualmente el panel de DevTools (que en fases anteriores
> de este proyecto se confirmó poco confiable de automatizar).

## Qué hace

`ecodata-lab-frontend/scripts/run-lighthouse.mjs` (invocado con
`pnpm run lighthouse`):

1. Levanta `pnpm start` (el build de producción, no `pnpm dev`) en background.
2. Espera a que el servidor responda en `http://localhost:3000` (poll simple
   con `fetch`, hasta 30s).
3. Lanza una instancia de Chrome headless (`chrome-launcher`).
4. Corre Lighthouse **vía su API programática** (`import lighthouse from
   "lighthouse"`, no el binario `lighthouse` invocado desde bash) contra cada
   ruta configurada, en las 4 categorías (`performance`, `accessibility`,
   `best-practices`, `seo`).
5. Guarda un reporte JSON + HTML por ruta en `lighthouse-reports/` (ignorado
   por git — son artefactos regenerables con un solo comando, igual criterio
   que ya se usa en este proyecto para no versionar salidas generadas).
6. Imprime una tabla resumen (ruta × 4 scores) y, debajo, la lista de audits
   con `score < 0.9` por categoría — el detalle que hace falta para
   diagnosticar sin tener que abrir cada JSON a mano.
7. Mata el proceso de `pnpm start` al terminar (incluyendo el árbol de
   procesos en Windows, donde `spawn(..., {shell:true})` crea un `cmd.exe`
   intermedio — `taskkill /T` es necesario para no dejar `next start` huérfano
   corriendo en background).

## Por qué API programática y no `lighthouse <url>` desde bash

La CLI de Lighthouse imprime a stdout un reporte legible por humanos, pero
extraer datos estructurados de ahí (qué audits fallan, con qué severidad)
requeriría parsear texto. La API (`lighthouse(url, options)`) devuelve el
mismo objeto de resultado (`.lhr`) que consume el reporte, así que se puede
recorrer `result.lhr.categories[cat].auditRefs` y filtrar por `score < 0.9`
directamente en JS — es lo que hace `auditRoute()` en el script.

## Por qué reportes en `lighthouse-reports/` y no versionados

Son la salida de una medición puntual contra el estado del código en un
momento dado — se desactualizan en cuanto cambia una línea. Versionarlos
invitaría a comparar contra un reporte viejo sin darse cuenta. La fuente de
verdad es "correlo de nuevo cuando lo necesites" (`pnpm run lighthouse`), no
un JSON committeado.

## Limitación real encontrada al usarlo (y cómo se detectó)

Al correr esto en una máquina con Kaspersky instalado, **el antivirus inyecta
su propio script de telemetría** (`gc.kis.v2.scr.kaspersky-labs.com`) en el
tráfico de `http://localhost`, a nivel de interceptación de red (no es una
extensión de Chrome — persiste incluso en Chrome headless recién lanzado sin
perfil de usuario). Esto se detectó leyendo el JSON crudo del reporte
(`lighthouse-reports/home.json` → `audits["is-on-https"].details.items` y
`audits["unminified-javascript"].details.items`) y viendo que **todas** las
URLs marcadas como "inseguras" o "sin minificar" eran del dominio de
Kaspersky, no de `localhost:3000`. Esto infló además el Total Blocking Time y
Time to Interactive reportados (el script de telemetría consume tiempo de
main thread real).

**Moraleja para reutilizar este patrón en otra máquina/proyecto**: si los
scores de Performance o Best Practices salen sospechosamente bajos, antes de
optimizar el código propio, revisar el JSON crudo (`network-requests`,
`is-on-https`, `unminified-javascript`) por dominios de terceros no
relacionados con la app (antivirus, extensiones corporativas de seguridad,
proxies de red). No asumir que un score bajo es siempre culpa del código
auditado.

## Cómo portar esto a otro proyecto Next.js

Copiar `scripts/run-lighthouse.mjs` + la entrada `"lighthouse": "node
scripts/run-lighthouse.mjs"` en `package.json` + `pnpm add -D lighthouse
chrome-launcher`, y ajustar solo el bloque marcado al inicio del archivo:

```js
// ── Específico de este proyecto: cambiar por las rutas del proyecto nuevo ──
const BASE_URL = "http://localhost:3000";
const ROUTES = [
  { label: "Home", path: "/" },
  { label: "Mapa", path: "/mapa" },
  { label: "Dashboard", path: "/dashboard" },
];
const START_COMMAND = "pnpm";
const START_ARGS = ["start"];
// ─────────────────────────────────────────────────────────────────────────
```

Todo lo demás (poll de arranque, llamada a Lighthouse, extracción de audits
fallidos, tabla resumen, kill del servidor) es genérico y no requiere tocarse
para cualquier app Next.js con `pnpm build && pnpm start`. Si el proyecto usa
`npm`/`yarn`, cambiar `START_COMMAND`/`START_ARGS` y el `package.json` script
equivalente.

## Resultado real de esta corrida (EcoData Lab)

Ver `docs/ESTADO_PROYECTO.md` → sección Lighthouse para los scores finales y
qué se corrigió con este detalle (bug real de accesibilidad en los sliders
AHP, y source maps de producción) vs. qué queda como límite arquitectónico
esperado de una app con mapbox-gl + deck.gl + three.js cargados de forma
inmersiva por diseño del producto.
