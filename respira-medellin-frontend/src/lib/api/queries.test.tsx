import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useComunas, useSaludResumenComuna } from "./queries";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const VALID_COMUNAS_RESPONSE = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { comuna: "11", nombre: "LAURELES" },
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    },
  ],
};

const VALID_SALUD_RESPONSE = {
  fuente: {
    nombre: "Metrosalud",
    url: "https://example.com/dataset",
    dataset_id: "abc-123",
    fecha_consulta: "2026-01-01",
    rango_datos_fuente: "2020-2025",
    filtro_aplicado: "diagnosticos respiratorios",
  },
  metodologia: "Datos de la red pública Metrosalud, no representan la morbilidad total de la ciudad.",
  comunas: [
    {
      comuna: "LAURELES",
      total_diagnosticos_respiratorios: 120,
      por_anio: { "2023": 60, "2024": 60 },
      top_diagnosticos: [{ codigo: "J45", nombre: "Asma", cantidad: 40 }],
    },
  ],
};

describe("useComunas", () => {
  it("resolves with zod-parsed data when the response matches the schema", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/comunas`, () => HttpResponse.json(VALID_COMUNAS_RESPONSE)),
    );

    const { result } = renderHook(() => useComunas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.features[0].properties.nombre).toBe("LAURELES");
  });

  it("fails gracefully (error state, no throw) when the response violates the schema", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/comunas`, () =>
        // `type` missing and `features` isn't an array — violates comunasFeatureCollectionSchema.
        HttpResponse.json({ nope: true }),
      ),
    );

    const { result } = renderHook(() => useComunas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe("useSaludResumenComuna", () => {
  it("resolves with zod-parsed data when the response matches the schema", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/salud/resumen-comuna`, () =>
        HttpResponse.json(VALID_SALUD_RESPONSE),
      ),
    );

    const { result } = renderHook(() => useSaludResumenComuna(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.comunas[0].comuna).toBe("LAURELES");
    expect(result.current.data?.comunas[0].total_diagnosticos_respiratorios).toBe(120);
  });

  it("fails gracefully (error state, no throw) when a required field is missing", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/salud/resumen-comuna`, () =>
        // `metodologia` is required (not optional, on purpose) and is omitted here.
        HttpResponse.json({
          fuente: VALID_SALUD_RESPONSE.fuente,
          comunas: VALID_SALUD_RESPONSE.comunas,
        }),
      ),
    );

    const { result } = renderHook(() => useSaludResumenComuna(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
