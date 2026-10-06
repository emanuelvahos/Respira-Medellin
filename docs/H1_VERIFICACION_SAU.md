# H1 — Verificación de los datos del SAU (2026-10-06)

Objetivo: saber con certeza cuántos árboles hay en Medellín según el SAU de la
Alcaldía, de dónde sale cada cifra y qué capa usar. Todo se midió descargando
los datos reales desde GitHub Actions (el servidor de la Alcaldía no es
alcanzable desde todos los entornos); nada se asume.

## Capas del servidor público (`ambiente_dllo_sost`)

| Capa | Filas | Árboles únicos | Medellín (únicos) | Notas |
|---|---|---|---|---|
| `Ciudadano/1` (la que usábamos) | 330.973 | 330.962 | 238.079 | Foto de octubre de 2023 (95 % con `fecha_actualizacion` 2023) |
| `Contrato/5` | 782.189 | 781.997 | 465.406 | Capa operativa, 10 municipios |
| `Contrato/3` "Estado" (**la que usamos ahora**) | 847.308 | 847.097 | 507.722 | Contrato + árboles talados/desaparecidos/muertos |

Cada árbol tiene como máximo 2 filas: las capas grandes **no** son
intervenciones repetidas, son más árboles. Los ~470–490 mil que comunica la
Alcaldía corresponden a Medellín en las capas operativas.

## Estado vs Contrato (solo Medellín)

- En ambas capas: 465.411 individuos, **sin ninguna diferencia** de estado.
- Solo en Estado: 42.315, todos talados (1.398), desaparecidos (30.154) o muertos (10.763).
- Solo en Contrato: 6 árboles vivos (despreciable).
- Árboles vivos: 431.904 (Estado) vs 431.910 (Contrato).

Conclusión: Estado es un superconjunto de Contrato, con más información sobre
árboles muertos o desaparecidos. Se usa Estado y se cuentan como "vivos" solo
los activos que no están muertos ni desaparecidos.

## Balance final (Medellín, descarga 2026-10-06)

Individuos únicos: 507.730 · **vivos: 431.908** · talados: 32.007 ·
desaparecidos: 32.446 · muertos: 10.763 · históricos: 606.

## Limitaciones declaradas

- **Estatus de la capa Contrato/Estado.** Está en el mismo servidor público de la
  Alcaldía, pero parece una vista operativa para gestionar contratos de
  silvicultura. No tenemos confirmación institucional de que sea el inventario
  oficial validado (pendiente; no se ha consultado a la Secretaría).
- **Frescura.** La fecha de actualización más reciente es 2026-10-05, pero una
  parte de los registros no tiene `fecha_actualizacion`. El estado "Activo" puede
  incluir árboles ya retirados que no se actualizaron.
- **Estado fitosanitario.** ~7.300 vivos sin estado; ~14.000 "Desconocido".
- **Sin DAP ni altura por individuo.** Ninguna capa los expone.
- **El modelo AHP v1 sigue usando el Excel antiguo** (`base_datos_arboles`,
  ~43.000 árboles en 11 comunas): por ejemplo El Poblado 2.209 (modelo) vs
  58.325 (SAU vivos). El dashboard lo indica. El AHP v2 con el SAU actual es el
  siguiente paso (H1b), en paralelo y sin tocar v1.

## Reproducir

`python backend/scripts/fetch_sau_arboles.py --comparar-contrato` (≈25 min).
