# Sistema de diseño — EcoData Lab Medellín

Fase 0. Este documento registra las decisiones de diseño tomadas para el
andamiaje del frontend. Los tokens viven en `src/app/globals.css`; este
archivo explica el *por qué*.

## Estilo elegido: "data-native minimalism" con acentos orgánicos

Se descartó el glassmorphism genérico de SaaS (paneles translúcidos,
gradientes morado-azul, iconografía redondeada tipo fintech) por no ser
coherente con un producto institucional-ambiental. En su lugar:

- **Modo oscuro por defecto**, con superficies casi negras teñidas de verde
  muy oscuro (no negro puro), que hacen que los acentos de vegetación y las
  visualizaciones de datos "floten" sobre el fondo — apropiado para un
  producto que en fases futuras mostrará mapas 3D y capas de datos.
- **Radios de esquina grandes y orgánicos** (`--radius-4xl` en tarjetas) en
  vez de esquinas duras de dashboard corporativo, para transmitir algo más
  cercano a lo natural sin caer en skeuomorfismo.
- **Tipografía con carácter editorial** en los titulares (ver abajo) para
  soportar el storytelling de fases posteriores, combinada con una tipografía
  de alta legibilidad para datos y UI.
- **Color con significado semántico estricto**: el verde no es decorativo,
  representa vegetación/cobertura arbórea; el rojo/naranja está reservado
  exclusivamente para severidad de PM2.5 y nunca se usa como acento de marca.

## Paleta de color

Definida en OKLCH para consistencia perceptual entre modo claro y oscuro
(ver `src/app/globals.css`).

| Token | Claro (hex aprox.) | Oscuro (hex aprox.) | Uso semántico |
|---|---|---|---|
| `background` | `#FCFBF8` | `#181D1A` | Fondo base |
| `foreground` | `#242B26` | `#EBEAE6` | Texto base |
| `card` | `#FFFFFF` | `#1F2521` | Superficies elevadas |
| `primary` / `vegetation` | `#2F7A4E` | `#7FD79E` | Marca, vegetación, cobertura arbórea, acciones principales |
| `vegetation-muted` | `#DCEEDF` | `#2A3B2E` | Fondos suaves para íconos/badges de vegetación |
| `earth` | `#8A6A3E` | `#B79361` | Suelo, inventario físico |
| `critical` | `#C43A2E` | `#D9584A` | **Solo** niveles críticos de PM2.5 (siempre + ícono/texto) |
| `warning` | `#DC9A3E` | `#E8AC55` | Niveles de alerta moderada de PM2.5 |
| `data-sky` | `#4E85A8` | `#6FA8C9` | Acento tecnológico, series de datos |
| `destructive` | `#C0392B` | `#DA6354` | Acciones destructivas de UI (distinto de `critical`) |
| `muted-foreground` | `#6B7568` | `#A7B0A2` | Texto secundario |
| `border` | `#DCD8CC` | `rgba(255,255,255,.12)` | Bordes, separadores |

Justificación: el verde de `primary`/`vegetation` es el mismo tono base en
ambos modos (ajustando solo luminosidad), de modo que la identidad de marca
no cambia al alternar tema. El par crítico/advertencia (rojo/naranja) queda
reservado exclusivamente para severidad de PM2.5 en las fases de datos —
nunca se reutiliza para CTAs ni navegación, para no diluir su significado de
alerta. Ningún estado crítico se comunica solo por color: siempre se
acompaña de ícono (`WarningIcon`, `WarningOctagonIcon` de Phosphor en fases
futuras) y de texto explícito ("Crítico", "Alerta").

## Tipografía

- **Headline — Fraunces** (`--font-fraunces`, variable, ejes `opsz/SOFT/WONK`
  activos): serif orgánica con carácter editorial. Se usa en `h1`–`h4` y en
  `CardTitle`. Su calidez y sus formas ligeramente "vivas" refuerzan la idea
  de datos ambientales sin caer en clichés de eco-branding (hojas, texturas).
- **Body — Inter** (`--font-sans`): sans-serif de alta legibilidad, optimizada
  para texto de UI, párrafos largos y — en fases futuras — cifras y tablas de
  datos.

Jerarquía documentada en `src/styles/tokens.md`.

## Espaciado

Escala base de 4px/8px (por defecto de Tailwind, `spacing(1) = 4px`). El
ritmo vertical de secciones usa múltiplos de 8px (`gap-4`, `gap-6`, `gap-8`,
`gap-16`); agrupaciones ícono+texto usan `gap-1`/`gap-1.5`.

## Iconografía

`@phosphor-icons/react` (import `.../dist/ssr` en Server Components) es la
única librería de íconos del proyecto. No se usan emojis como íconos
estructurales en ninguna parte de la interfaz.

## Accesibilidad y prioridades aplicadas

Siguiendo la tabla de prioridades 1–6 (Accessibility, Touch & Interaction,
Performance, Style Selection, Layout & Responsive, Typography & Color):

1. **Accesibilidad**: `lang="es"` en `<html>`, navegación con `aria-label`,
   toggle de tema con `aria-label` dinámico, foco visible (`focus-visible:ring`)
   en todos los elementos interactivos, contraste verificado en ambos modos.
2. **Touch & Interaction**: objetivos táctiles ≥ 40px (`size-9`/`size-11`),
   navegación móvil con scroll horizontal explícito en vez de menú oculto
   (evita ocultar contenido de navegación por defecto en fase de andamiaje).
3. **Performance**: sin librerías de mapas/3D/animación en esta fase; fuentes
   cargadas vía `next/font` (self-hosted, sin layout shift).
4. **Style Selection**: ver sección de estilo arriba.
5. **Layout & Responsive**: mobile-first, `MainContainer` con `max-w-6xl` y
   padding fluido, sin scroll horizontal entre 375px y 1920px.
6. **Typography & Color**: pares de contraste AA verificados en `:root` y
   `.dark`; color nunca como único portador de significado en estados
   semánticos.
