import sentry_sdk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import arboles, calidad, comunas, pm25, salud, siembra, zonas_verdes

settings = get_settings()


def _before_send(event: dict, hint: dict) -> dict | None:
    """Filtra de Sentry las HTTPException que son estados de dominio
    esperados (503 de dataset no disponible, 422 de validación de pesos
    AHP), no errores del sistema. Solo 500+ sin HTTPException explícita
    (fallos no manejados) deben generar una alerta."""
    exc_info = hint.get("exc_info")
    if exc_info:
        exc = exc_info[1]
        if isinstance(exc, HTTPException) and exc.status_code < 500:
            return None
    return event


if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        # Free tier: cuota mensual de eventos limitada, no hace falta
        # tracear el 100% de requests para detectar regresiones de latencia.
        traces_sample_rate=0.1,
        before_send=_before_send,
    )

app = FastAPI(
    title="EcoData Lab Medellín — API",
    description=(
        "Capa de servicio sobre los datasets ya generados por el pipeline "
        "de ciencia de datos (bloque_1/bloque_2). No recalcula el modelo "
        "AHP ni el spatial join: solo los expone como JSON/GeoJSON tipado."
    ),
    version="0.1.0",
)

# En producción, agrega el dominio del frontend desplegado, p. ej.:
# settings.cors_allowed_origins = "http://localhost:3000,https://ecodata-lab.medellin.gov.co"
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(comunas.router)
app.include_router(pm25.router)
app.include_router(siembra.router)
app.include_router(zonas_verdes.router)
app.include_router(arboles.router)
app.include_router(salud.router)
app.include_router(calidad.router)


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"status": "ok", "docs": "/docs"}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
