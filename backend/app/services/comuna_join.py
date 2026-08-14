"""Normalización de nombre de comuna para cruces entre datasets.

El proyecto cruza comunas por NOMBRE normalizado (mayúsculas, sin tildes),
no por código numérico DANE/Decreto 346 de 2000: ese código solo existe hoy
en `limite_catastral_de_comun.geojson` (`properties.comuna`), mientras que
todos los demás datasets (recomendación de siembra, salud respiratoria,
población) usan el nombre como llave. Ver backend/README.md, sección
"Cruce de comunas", para la justificación de por qué no se migró el cruce
completo a código en esta integración.

Espejo en TypeScript: ecodata-lab-frontend/src/lib/map/matchComuna.ts
(misma lista de alias, mismo algoritmo NFD). Si se agrega un alias aquí,
agregarlo también allá.
"""

import unicodedata

_ALIASES = {
    "LAURELES ESTADIO": "LAURELES",
    "SAN SEBASTIAN DE PALMITAS": "PALMITAS",
}

_PREFIJO_CORREGIMIENTO = "CORREGIMIENTO DE "


def normalize_comuna_name(nombre: str) -> str:
    """Mayúsculas, sin tildes, sin prefijo 'Corregimiento de', con alias conocidos.

    Ej: "Corregimiento de San Cristóbal" -> "SAN CRISTOBAL"
        "Laureles Estadio" -> "LAURELES"
        "Corregimiento de San Sebastián de Palmitas" -> "PALMITAS"
    """
    sin_tildes = "".join(
        c for c in unicodedata.normalize("NFD", nombre) if unicodedata.category(c) != "Mn"
    )
    normalizado = sin_tildes.upper().strip()
    if normalizado.startswith(_PREFIJO_CORREGIMIENTO):
        normalizado = normalizado[len(_PREFIJO_CORREGIMIENTO) :]
    return _ALIASES.get(normalizado, normalizado)
