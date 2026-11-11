import * as Sentry from "@sentry/nextjs";
import { ApiError } from "@/lib/api/client";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Trazas de performance: 10-20% alcanza para detectar regresiones sin
  // agotar la cuota mensual de eventos del free tier.
  tracesSampleRate: 0.1,

  // Session Replay deshabilitado a propósito: no se agrega la integración
  // `replayIntegration()`. El free tier tiene un tope mensual bajo de
  // replays y no aporta al objetivo (diagnosticar errores, no grabar
  // sesiones) — se puede activar más adelante con un sampleRate bajo si
  // hace falta ver "qué hacía el usuario" más allá del stack trace.

  // Un `ApiError` con status 503 (dataset no disponible, p. ej.
  // /api/zonas-verdes sin el dataset aún) o 422 (validación de pesos AHP)
  // es un estado de dominio esperado, ya manejado por TanStack Query y la
  // UI — no un error no manejado. Reportarlos como "issue" generaría ruido
  // desde el día uno (zonas-verdes en 503 fue la normalidad por meses).
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (error instanceof ApiError && (error.status === 503 || error.status === 422)) {
      return null;
    }
    return event;
  },

  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
