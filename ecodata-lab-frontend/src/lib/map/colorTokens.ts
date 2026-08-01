/**
 * deck.gl necesita colores RGBA planos, pero el design system (Fase 0) solo
 * expone variables CSS (oklch). Este helper resuelve una variable CSS a un
 * [r, g, b, a] leyendo el color computado del navegador (respeta light/dark),
 * en vez de duplicar valores hex/oklch sueltos dentro de los archivos de capas.
 */

export type RGBAColor = [number, number, number, number];

const cache = new Map<string, RGBAColor>();
let probeEl: HTMLDivElement | null = null;
let probeCtx: CanvasRenderingContext2D | null = null;

function getProbeElement(): HTMLDivElement {
  if (!probeEl) {
    probeEl = document.createElement("div");
    probeEl.style.display = "none";
    document.body.appendChild(probeEl);
  }
  return probeEl;
}

/**
 * El navegador computa los tokens del design system en espacios de color
 * amplios (`oklch(...)`, `lab(...)`) y los preserva tal cual, incluso al leer
 * de vuelta `canvas.fillStyle` — no hay garantía de que se sirialicen como
 * `rgb()`. La única conversión confiable a bytes sRGB es rasterizar un
 * píxel con ese color y leer sus bytes reales con `getImageData`.
 */
function parseComputedColor(computed: string, alpha: number): RGBAColor {
  if (!probeCtx) {
    probeCtx = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    });
  }
  if (!probeCtx) return [0, 0, 0, Math.round(alpha * 255)];

  probeCtx.fillStyle = computed;
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
  const baseAlpha = a / 255;
  return [r, g, b, Math.round(baseAlpha * alpha * 255)];
}

/** Resuelve `--token` (sin el prefijo `--`) a RGBA, usando `alpha` en [0, 1]. */
export function tokenToRGBA(token: string, alpha = 1): RGBAColor {
  const cacheKey = `${token}:${alpha}:${document.documentElement.classList.contains("dark")}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const el = getProbeElement();
  el.style.color = `var(--${token})`;
  const computed = getComputedStyle(el).color;
  const rgba = parseComputedColor(computed, alpha);
  cache.set(cacheKey, rgba);
  return rgba;
}

/** Limpia la caché (llamar tras un cambio de tema claro/oscuro). */
export function clearTokenColorCache(): void {
  cache.clear();
}

/**
 * Interpola linealmente entre paradas de color de tokens del design system
 * (p. ej. la rampa semántica --vegetation -> --warning -> --critical) según
 * un valor `t` normalizado en [0, 1].
 */
export function interpolateTokenRamp(
  stops: string[],
  t: number,
  alpha = 1,
): RGBAColor {
  const clamped = Math.min(1, Math.max(0, t));
  const colors = stops.map((token) => tokenToRGBA(token, alpha));
  if (colors.length === 1) return colors[0];

  const segment = clamped * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(segment));
  const localT = segment - index;
  const a = colors[index];
  const b = colors[index + 1];

  return [
    Math.round(a[0] + (b[0] - a[0]) * localT),
    Math.round(a[1] + (b[1] - a[1]) * localT),
    Math.round(a[2] + (b[2] - a[2]) * localT),
    Math.round(a[3] + (b[3] - a[3]) * localT),
  ];
}
