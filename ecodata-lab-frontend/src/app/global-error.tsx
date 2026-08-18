"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        {/* Fallback mínimo: este layout reemplaza al root layout cuando
            este mismo falla en renderizar, así que no puede depender de
            ninguno de sus providers/estilos. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
