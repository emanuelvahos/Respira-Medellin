# proyecto-alcaldia — EcoData Lab Medellín

[![CI](https://github.com/emanuelvahos/Eco-Data-Lab/actions/workflows/ci.yml/badge.svg)](https://github.com/emanuelvahos/Eco-Data-Lab/actions/workflows/ci.yml)

Monorepo del proyecto de arborización urbana para mitigación de PM2.5 en
Medellín. El proyecto **activo** son dos carpetas desplegadas por separado:

- **`ecodata-lab-frontend/`** — frontend Next.js (landing con scroll-telling,
  mapa 3D, dashboard analítico con comparador AHP). Ver su `README.md` para
  desarrollo local y deploy a Vercel.
- **`backend/`** — API FastAPI que expone los datasets ya generados por el
  pipeline de ciencia de datos (no recalcula nada, solo sirve JSON/GeoJSON
  tipado). Autocontenida: sus datos viven en `backend/data/`, no depende de
  ninguna ruta fuera de sí misma. Ver su `README.md` para deploy a Railway.

**`Visualizacion-de-datos/`** es el repositorio original del pipeline de
ciencia de datos (Python + Streamlit) que produjo los datasets que el backend
sirve — queda como referencia histórica/auditable, pero ya no es el frontend
activo ni una dependencia funcional de deploy. Ver
[`docs/GUIA_MIGRACION.md`](./docs/GUIA_MIGRACION.md) para el detalle completo
de esa migración, y [`docs/ESTADO_PROYECTO.md`](./docs/ESTADO_PROYECTO.md)
para el estado actual del proyecto y cómo levantar todo desde cero. Ver
[`docs/ACTUALIZACION_DATOS.md`](./docs/ACTUALIZACION_DATOS.md) para la
cadencia recomendada de refresco de cada fuente de datos y el checklist de
cómo hacerlo.

## Deploy

| Carpeta | Plataforma | Root Directory a configurar |
|---|---|---|
| `ecodata-lab-frontend/` | Vercel | `ecodata-lab-frontend` |
| `backend/` | Railway | `backend` |

Variables de entorno de cada lado, documentadas en su propio README.
