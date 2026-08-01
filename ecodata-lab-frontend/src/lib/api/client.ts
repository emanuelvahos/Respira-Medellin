export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// El backend (Render, plan Free) se duerme tras 15 min sin tráfico: el primer
// request tras dormir puede tardar ~30-50s en responder mientras el
// contenedor arranca de nuevo. 60s de margen cubre ese cold start sin dejar
// una petición realmente caída colgada para siempre.
const REQUEST_TIMEOUT_MS = 60_000;

export async function apiFetch<TRaw = unknown>(
  path: string,
  init?: RequestInit,
): Promise<TRaw> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(
      `No se pudo conectar con el backend en ${API_BASE_URL}. ¿Está corriendo 'uvicorn app.main:app --reload'?`,
      0,
      url,
    );
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // el cuerpo no era JSON; nos quedamos con statusText
    }
    throw new ApiError(detail, response.status, url);
  }

  return (await response.json()) as TRaw;
}
