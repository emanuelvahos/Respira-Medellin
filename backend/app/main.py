from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import arboles, comunas, pm25, salud, siembra, zonas_verdes

settings = get_settings()

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


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"status": "ok", "docs": "/docs"}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
