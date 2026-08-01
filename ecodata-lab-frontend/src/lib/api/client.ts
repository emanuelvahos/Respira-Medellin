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

export async function apiFetch<TRaw = unknown>(
  path: string,
  init?: RequestInit,
): Promise<TRaw> {
  const url = `${API_BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, init);
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
