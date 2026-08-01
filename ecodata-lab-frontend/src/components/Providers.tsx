"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ColdStartNotice } from "@/components/ColdStartNotice";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());

  // Ping silencioso a /health apenas monta la app: el backend (Render, plan
  // Free) puede estar dormido tras 15 min sin tráfico, así que esto empieza a
  // despertarlo mientras el usuario todavía está en las primeras secciones de
  // la landing (que no dependen del backend) — no bloquea nada ni afecta la UI.
  React.useEffect(() => {
    fetch(`${API_BASE_URL}/health`).catch(() => {
      // sin manejo: es solo un intento de "despertar", los datos reales se
      // piden y muestran su propio estado de carga/error por separado.
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ColdStartNotice />
    </QueryClientProvider>
  );
}
