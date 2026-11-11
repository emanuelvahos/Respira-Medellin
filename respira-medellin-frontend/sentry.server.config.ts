import * as Sentry from "@sentry/nextjs";
import { ApiError } from "@/lib/api/client";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Captura el 100% de errores; el free tier limita por volumen de eventos,
  // no por dejar pasar errores reales de un backend que ya es de bajo tráfico.
  tracesSampleRate: 0.1,

  // Los 503 (dataset no disponible) y 422 (validación AHP) son respuestas
  // HTTP normales del dominio, no errores del servidor: no deben consumir
  // cuota de "issues" de Sentry. Esta instancia de Sentry solo instrumenta
  // este proceso Next.js (SSR/route handlers); el backend FastAPI se
  // filtra por separado en app/main.py con su propio DSN.
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (error instanceof ApiError && (error.status === 503 || error.status === 422)) {
      return null;
    }
    return event;
  },

  debug: false,
});
