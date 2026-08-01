# Estado del proyecto — EcoData Lab Medellín

> Inventario honesto de qué funciona, qué quedó documentado como limitación, y
> cómo levantar todo desde cero. Escrito al cierre de la Fase 6 (entrega
> final). Ver también `docs/GUIA_MIGRACION.md` para el contexto de por qué la
> arquitectura es la que es.

## 1. Qué está 100% funcional

- **Landing (`/`)**: scroll-telling con secciones sincronizadas a la cámara
  del mapa, `prefers-reduced-motion` respetado en toda la animación (GSAP +
  three.js).
- **Mapa 3D (`/mapa`)**: comunas extruidas por score AHP (color + altura),
  zonas de siembra priorizadas, partículas PM2.5 animadas por estación real,
  árboles 3D al seleccionar una comuna (troncos/copas instanciados,
  muestreados — ver limitaciones abajo), panel de detalle de comuna, y un
  selector de comuna por teclado (`ComunaKeyboardSelector`) como alternativa
  no-visual a hacer click sobre el canvas WebGL.
- **Dashboard (`/dashboard`)**: KPIs, PM2.5 por comuna y en el tiempo, tabla
  de comunas ordenable/filtrable, comparador de escenarios AHP con sliders
  operables por teclado (flechas) que anuncian su valor a lectores de
  pantalla (`aria-valuenow` + `aria-valuetext`) y recalculan en vivo.
- **Backend FastAPI**: los 9 endpoints sobre datos reales responden 200
  (`/api/comunas`, `/api/comunas/{nombre}`, `/api/comunas/estaciones/auditoria`,
  `/api/pm25`, `/api/pm25/relaciones-anuales`, `/api/pm25/estaciones`,
  `/api/siembra/zonas`, `/api/siembra/zonas/geojson`,
  `/api/siembra/resumen-comuna`, `/api/siembra/ranking-comunas`).
- **Ranking AHP con pesos por defecto** reproduce exactamente
  (`ranking_prioridad` 1-5 verificado) el CSV original del pipeline
  (`resumen_recomendacion_por_comuna.csv`).
- **Modo oscuro/claro** consistente en las 3 páginas — verificado que
  `MapLegend`, `MapLayerToggles` y `AhpScenarioComparator` usan tokens del
  sistema de diseño (Fase 0), sin color hardcodeado que rompa el toggle.
- **Limpieza**: `/debug/data` eliminado (confirmado 404), sin
  `console.log`/`console.warn` de debugging en el código.

## 2. Limitaciones conocidas (documentadas, no ocultas)

### `/api/zonas-verdes` → 503
El archivo `inventario_zonas_verdes.geojson` no existe en el repo de datos
(`Visualizacion-de-datos`) en la ruta que `bloque2_recomendador_siembra.py`
espera — problema del dataset fuente, no del backend ni del frontend. El
endpoint está completamente implementado y responderá 200 en cuanto el
archivo exista en la ruta configurada en `DATA_INVENTARIO_ZONAS_VERDES`. El
frontend maneja esto con gracia: el toggle de la capa "Zonas verdes
(inventario)" aparece deshabilitado con la nota "Datos no disponibles" en vez
de fallar silenciosamente o romper el mapa.

### Árboles 3D: muestra, no censo completo
`TreeInstances` no renderiza el censo real de árboles por comuna (serían
miles de instancias); usa una muestra representativa cuyo tamaño se deriva
del dato real (`arboles_totales / 25`, con techo `MAX_EXISTING_TREE_INSTANCES`).
Esto es una decisión de performance explícita de la Fase 3/5, no una
regresión — está documentado en el propio código
(`src/components/map/MapCanvas.tsx`, comentario junto a `treePoints`).

### Favicon
Reemplazado en la Fase 6 por un ícono de hoja estilizado (`src/app/icon.svg`
+ `src/app/favicon.ico` regenerado), en el verde primario del sistema de
diseño (`--vegetation`). Es un asset simple hecho a mano, no un logo de marca
elaborado — suficiente para que el sitio no salga con el ícono default de
`create-next-app`, pero no reemplaza un ejercicio real de identidad visual si
la Secretaría quiere uno más adelante.

### Lighthouse

Automatizado con `pnpm run lighthouse` (Lighthouse CLI vía API programática,
Chrome headless — ver `docs/lighthouse-automation.md` para cómo funciona y
cómo reutilizarlo en otro proyecto). Scores finales, post-fixes, contra el
build de producción (`pnpm build && pnpm start`):

| Página | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 30 | 100 | 77 | 100 |
| `/mapa` | 31 | 100 | 77 | 100 |
| `/dashboard` | 38-40 | 100 | 81 | 100 |

**Fixes reales aplicados y confirmados con una segunda corrida** (antes → después):
- **Accessibility `/dashboard`: 89 → 100.** El audit `aria-input-field-name`
  señaló que los sliders del comparador AHP no tenían nombre accesible: el
  `aria-label` se pasaba al `<SliderPrimitive.Root>`, pero el elemento con
  `role="slider"` real es el `<Thumb>` interno de Radix, que quedaba sin
  nombre. Corregido en `src/components/ui/slider.tsx` (el `aria-label` ahora
  se reenvía al `Thumb`, no al `Root`).
- **Best Practices, "Missing source maps": corregido en `/mapa` y
  `/dashboard`** (antes fallaba en las 3, ahora solo queda un caso aislado en
  `/`) activando `productionBrowserSourceMaps: true` en `next.config.ts`.

**Por qué Performance bajó más de lo esperado y por qué no se persigue más
en esta fase — hallazgo real, no una excusa:**

Durante el diagnóstico se descubrió, leyendo el JSON crudo del reporte (no
solo el score), que **Kaspersky** (antivirus instalado en la máquina donde se
corrió la auditoría) inyecta su propio script de telemetría
(`gc.kis.v2.scr.kaspersky-labs.com`) en el tráfico de `http://localhost` a
nivel de red — no como extensión de Chrome, sino interceptando la conexión,
por lo que persiste incluso en Chrome headless recién lanzado. Confirmado con
tres corridas independientes (antes y después de dos intentos del usuario de
desactivarlo): **el audit `is-on-https` ("Does not use HTTPS") lista
exclusivamente URLs de Kaspersky como "inseguras", nunca del propio sitio**, y
buena parte del tiempo de bloqueo de main-thread reportado corresponde a ese
script de terceros, no al código de la aplicación. Esto infla artificialmente
el score de Performance reportado en este entorno específico — el número real
en un entorno limpio (o en el deploy de producción real) sería más alto,
aunque de todas formas por debajo de 90 (ver siguiente párrafo).

Descontando ese ruido, el Performance real de la app sigue siendo bajo
(LCP/TBT elevados, "Reduce unused JavaScript" con ~900 KiB en `/` y `/mapa`)
por una razón arquitectónica **intencional, no un bug**: `HomeClient.tsx`
monta `<MapCanvas />` (mapbox-gl + deck.gl + three.js) de forma inmediata y
permanente como fondo fijo de toda la landing, porque el scroll-telling de la
Fase 3 depende de que la cámara del mapa esté sincronizada con el scroll
desde la primera sección — no es un mapa que aparece más adelante en la
página. Retrasar esa carga mejoraría el score pero rompería la experiencia
central del producto (el mapa como protagonista visual desde el primer
scroll), así que **no se aplicó** — es un trade-off de producto explícito,
documentado aquí en vez de aplicado en silencio, tal como pide la restricción
de la Fase 5/6 de no cambiar comportamiento visible sin decirlo. En un deploy
real a Vercel (CDN, HTTP/2, sin la interferencia de un antivirus local) estos
números deberían mejorar por sí solos, pero seguirán reflejando el costo real
de cargar tres librerías 3D/mapas de forma inmersiva.

### Framerate de `/mapa`
No se pudo medir de forma automatizada en este entorno (el contador vía
`requestAnimationFrame` se pausa cuando la pestaña no está en foco durante la
automatización del navegador). Se solicitó al usuario medirlo manualmente
(DevTools → Performance, o el medidor de FPS del navegador) durante el cierre
de la Fase 6; **pendiente de actualizar este documento con el número real**
una vez lo confirme.

## 3. Cómo correr todo desde cero

### Requisitos
- Node.js 20+ y pnpm (o `npm` como alternativa).
- Python 3.11+ con `venv`.
- Un token público de Mapbox GL JS (gratis en [mapbox.com](https://account.mapbox.com/access-tokens/)).

No hace falta clonar `Visualizacion-de-datos/` aparte: los datasets que el
backend necesita ya están copiados en `backend/data/` (organización de
monorepo para deploy, ver `docs/GUIA_MIGRACION.md`).

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # las rutas DATA_* ya apuntan a ./data/, no requieren ajuste
uvicorn app.main:app --reload
```

Verificar: `http://localhost:8000/docs` (Swagger) y
`http://localhost:8000/api/comunas` (debe responder 200).

### 2. Frontend

```bash
cd ecodata-lab-frontend
pnpm install
cp .env.local.example .env.local
# Editar .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000
#                     NEXT_PUBLIC_MAPBOX_TOKEN=<tu token>
pnpm dev
```

Abrir `http://localhost:3000`. El backend debe estar corriendo primero (o al
menos antes de navegar a `/mapa` o `/dashboard`, que dependen de sus datos).

### 3. Verificación de build de producción

```bash
cd ecodata-lab-frontend
pnpm build && pnpm lint
pnpm start   # sirve el build de producción en :3000, para medir Lighthouse real
```

### Orden recomendado al arrancar
1. Backend (`uvicorn`) — sin esto, `/mapa` y `/dashboard` muestran estados de
   carga/error, no fallan de forma silenciosa.
2. Frontend (`pnpm dev` o `pnpm start`).
3. Confirmar `NEXT_PUBLIC_MAPBOX_TOKEN` está seteado — sin él, `/mapa` muestra
   un aviso explícito en vez de intentar cargar un mapa roto.

## 4. Deploy

No se desplegó a producción real en esta fase (decisión explícita: no se
asumió por defecto, ver `docs/GUIA_MIGRACION.md` y los README de cada parte
para los pasos documentados). Instrucciones completas de deploy:
`ecodata-lab-frontend/README.md` (Vercel) y `backend/README.md`
(Railway/Render/Docker).

**Pendiente de seguridad antes de cualquier deploy real**: restringir el
token público de Mapbox por dominio en
[el dashboard de Mapbox](https://account.mapbox.com/access-tokens/) una vez se
conozca la URL de producción — documentado desde la Fase 2, repetido aquí
porque es el paso que más fácil se olvida.
