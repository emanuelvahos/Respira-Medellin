# Referencia de tokens

Fuente de verdad: `src/app/globals.css` (`:root` y `.dark`). Esta tabla es solo
una referencia legible; no la edites por separado de `globals.css`.

## Color semántico

| Token CSS | Clase Tailwind | Uso |
|---|---|---|
| `--background` / `--foreground` | `bg-background` / `text-foreground` | Fondo y texto base de la página |
| `--card` / `--card-foreground` | `bg-card` / `text-card-foreground` | Superficies elevadas (tarjetas, paneles) |
| `--primary` / `--primary-foreground` | `bg-primary` / `text-primary-foreground` | Acciones principales |
| `--secondary` / `--secondary-foreground` | `bg-secondary` / `text-secondary-foreground` | Acciones y superficies secundarias |
| `--muted` / `--muted-foreground` | `bg-muted` / `text-muted-foreground` | Texto y superficies de baja jerarquía |
| `--accent` / `--accent-foreground` | `bg-accent` / `text-accent-foreground` | Resaltados sutiles, badges |
| `--border` / `--input` / `--ring` | `border-border` / `border-input` / `ring-ring` | Bordes, inputs, foco |
| `--vegetation` / `--vegetation-foreground` / `--vegetation-muted` | `bg-vegetation`, `text-vegetation`, `bg-vegetation-muted` | Color de marca: cobertura arbórea, siembra, indicadores positivos |
| `--earth` / `--earth-foreground` | `bg-earth`, `text-earth` | Suelo, inventario físico, elementos "tierra" |
| `--critical` / `--critical-foreground` | `bg-critical`, `text-critical` | **Solo** niveles críticos de PM2.5. Nunca decorativo. Acompañar siempre con ícono/texto, nunca solo color. |
| `--warning` / `--warning-foreground` | `bg-warning`, `text-warning` | Niveles de alerta moderada de PM2.5 |
| `--data-sky` / `--data-sky-foreground` | `bg-data-sky`, `text-data-sky` | Acento tecnológico/datos (gráficas, líneas de series) |
| `--destructive` | `bg-destructive` | Acciones destructivas de UI (eliminar, cancelar) — semánticamente distinto de `--critical` (calidad del aire) |

**Regla dura:** ningún componente debe usar un valor `hex`/`oklch` suelto.
Todo color pasa por una de las variables de arriba o por las utilidades de
`chart-1..5` para series de datos.

## Tipografía

- **Heading** (`font-heading` → `--font-fraunces`): Fraunces, serif variable
  orgánica. Usada en `h1`–`h4` y en `CardTitle`. Transmite carácter editorial
  y "vivo" frente a un sans genérico de SaaS.
- **Body** (`font-sans` → `--font-sans`, Inter): texto de párrafo, UI,
  datos tabulares. Alta legibilidad en tamaños pequeños y en pantallas de
  dashboard.

Jerarquía tipográfica de referencia (móvil → desktop):

| Elemento | Clase | Tamaño |
|---|---|---|
| H1 | `text-4xl sm:text-5xl md:text-6xl` | 36px → 60px |
| H2 | `text-3xl sm:text-4xl` | 30px → 36px |
| H3 (CardTitle) | `text-xl` | 20px |
| Body | `text-base` | 16px |
| Small / meta | `text-sm` / `text-xs` | 14px / 12px |

## Espaciado

Escala base 4px (Tailwind por defecto: `spacing(1) = 0.25rem = 4px`). En este
proyecto se usan preferentemente los múltiplos de 8px (`gap-2`, `gap-4`,
`gap-6`, `gap-8`, `gap-16`) para ritmo vertical, reservando `gap-1`/`gap-1.5`
para agrupaciones muy ajustadas (ícono + texto).

## Radios

`--radius: 0.5rem` como base; `--radius-sm/md/lg/xl/2xl/3xl/4xl` se derivan de
ella en `globals.css`. Las tarjetas de shadcn usan `--radius-4xl` (esquinas
suaves, orgánicas — coherente con el estilo elegido).
