# EcoData Lab Medellín — Frontend

Frontend en Next.js del proyecto de arborización urbana y mitigación de PM2.5
para la Secretaría de Medio Ambiente de Medellín. **Fase 0**: andamiaje del
proyecto y sistema de diseño base — sin consumo de datos reales todavía.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (Radix)
- `@phosphor-icons/react` para iconografía
- `next-themes` para modo claro/oscuro
- ESLint (`eslint-config-next` + `eslint-plugin-jsx-a11y`) + Prettier

## Requisitos

- Node.js 20+
- pnpm (recomendado). Si no está disponible, usar `npm` como alternativa.

## Instalación y ejecución

```bash
pnpm install
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Scripts disponibles

| Script | Descripción |
|---|---|
| `pnpm dev` | Servidor de desarrollo (Turbopack) |
| `pnpm build` | Build de producción |
| `pnpm start` | Sirve el build de producción |
| `pnpm lint` | ESLint (incluye reglas de accesibilidad `jsx-a11y`) |
| `pnpm format` | Formatea el código con Prettier |
| `pnpm format:check` | Verifica formato sin escribir cambios |

## Estructura del proyecto

```
src/
├── app/                # App Router: layout, page, estilos globales
├── components/
│   ├── ui/              # Componentes shadcn/ui
│   └── layout/           # Header, Footer, MainContainer, ThemeToggle
├── lib/                 # Utilidades (cn, etc.)
├── config/               # Metadata del sitio, navegación
├── styles/               # Referencia legible de tokens de diseño
└── types/                # Tipos compartidos (se puebla en Fase 1)
docs/
└── design-system.md     # Decisiones de diseño documentadas
```

Ver [`docs/design-system.md`](./docs/design-system.md) para la justificación
de estilo, paleta y tipografía, y [`src/styles/tokens.md`](./src/styles/tokens.md)
para la referencia de tokens.

## Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar:

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL base del backend FastAPI (ver `backend/README.md`). |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token público de Mapbox GL JS. Sin este valor, `/mapa` muestra un aviso en vez de intentar cargar el mapa. |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN del proyecto "Next.js" en [Sentry](https://sentry.io), para monitoreo de errores en producción. Público por diseño (igual que el token de Mapbox). Sin este valor, Sentry simplemente no reporta nada. |

## Deploy (Vercel)

1. Importar el repo en [Vercel](https://vercel.com/new), seleccionando
   `ecodata-lab-frontend` como *root directory* si el repo es un monorepo.
2. Framework preset: Next.js (detectado automáticamente).
3. Configurar en **Project Settings → Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: URL pública del backend ya desplegado (ver
     `backend/README.md` para opciones de despliegue).
   - `NEXT_PUBLIC_MAPBOX_TOKEN`: token público de Mapbox.
   - `NEXT_PUBLIC_SENTRY_DSN`: DSN del proyecto "Next.js" en Sentry.
4. Deploy. Cualquier plataforma compatible con Next.js App Router (Netlify,
   Render static+SSR, etc.) sirve igual, siempre que soporte las mismas
   variables de entorno.

**Pendiente de seguridad antes de producción**: una vez se conozca la URL
final de producción, restringir el token público de Mapbox por dominio en
[el dashboard de Mapbox](https://account.mapbox.com/access-tokens/) (URL
restrictions → agregar el dominio de producción). Mientras no se restrinja,
el token es utilizable desde cualquier origen.

## Estado conocido

- El favicon (`src/app/favicon.ico`) sigue siendo el default de
  `create-next-app`; reemplazarlo requiere un asset de marca que no existe
  todavía en el proyecto.
