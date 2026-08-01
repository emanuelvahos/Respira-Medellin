/**
 * Sincronización coordenadas geográficas -> espacio 3D de three.js.
 *
 * Esta es la pieza técnicamente más delicada de la Fase 3: hacer que una
 * escena R3F (árboles instanciados) parezca "pegada" al mapa Mapbox/deck.gl
 * de fondo cuando el usuario selecciona una comuna.
 *
 * ENFOQUE (simplificado, documentado explícitamente):
 * 1. Se fija un origen local (el centroide de la comuna, en lon/lat).
 * 2. Cada punto geográfico se convierte a metros ENU (East-North-Up) relativos
 *    a ese origen con una proyección equirectangular — válida con error
 *    despreciable a la escala de una comuna (cientos de metros), pero NO es
 *    una proyección Mercator exacta.
 * 3. La cámara three.js se reposiciona a partir del estado de la cámara de
 *    Mapbox (center/zoom/pitch/bearing) usando la relación estándar entre
 *    FOV, altura del viewport y "metros por pixel" a un zoom/latitud dados,
 *    para aproximar la altitud y el desplazamiento de la cámara real de
 *    Mapbox. Esto reproduce la sensación de estar mirando el mismo punto
 *    desde el mismo ángulo, pero NO es un registro píxel-perfecto.
 *
 * Alternativa "exacta" (fuera de alcance de esta fase): usar una Mapbox
 * Custom Layer (`type: "custom"`, `renderingMode: "3d"`) que entrega en su
 * callback `render(gl, matrix)` la matriz de proyección Mercator exacta de
 * Mapbox, y alimentar esa matriz directamente a la cámara three.js vía
 * `camera.projectionMatrix.fromArray(matrix)`. Se documenta aquí como la
 * ruta de mejora futura (ver ejemplo oficial de Mapbox "Add a 3D model").
 */

export const MAPBOX_DEFAULT_FOV_DEG = 36.87;

const METERS_PER_DEGREE_LAT = 111_320;

function metersPerDegreeLon(latitudeDeg: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((latitudeDeg * Math.PI) / 180);
}

/** Aproximación equirectangular: suficiente a escala de comuna (no usar a escala continental). */
export function lonLatToLocalMeters(
  origin: [number, number],
  point: [number, number],
): [number, number] {
  const [originLon, originLat] = origin;
  const [lon, lat] = point;
  const east = (lon - originLon) * metersPerDegreeLon(originLat);
  const north = (lat - originLat) * METERS_PER_DEGREE_LAT;
  return [east, north];
}

function metersPerPixel(latitudeDeg: number, zoom: number): number {
  const earthCircumferenceM = 40_075_016.686;
  return (earthCircumferenceM * Math.cos((latitudeDeg * Math.PI) / 180)) / Math.pow(2, zoom + 8);
}

export type MapCameraState = {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
};

export type ThreeCameraPose = {
  position: [number, number, number];
  fovDeg: number;
};

/** Ver comentario de módulo: aproximación intencional, no registro píxel-perfecto. */
export function computeThreeCameraPose(
  mapState: MapCameraState,
  origin: [number, number],
  viewportHeightPx: number,
  fovDeg: number = MAPBOX_DEFAULT_FOV_DEG,
): ThreeCameraPose {
  const fovRad = (fovDeg * Math.PI) / 180;
  const cameraToCenterDistancePx = (0.5 * viewportHeightPx) / Math.tan(fovRad / 2);
  const altitudeM = cameraToCenterDistancePx * metersPerPixel(mapState.center[1], mapState.zoom);

  const pitchRad = (mapState.pitch * Math.PI) / 180;
  const bearingRad = (mapState.bearing * Math.PI) / 180;
  const groundDistanceM = altitudeM * Math.tan(pitchRad);

  const [centerEast, centerNorth] = lonLatToLocalMeters(origin, mapState.center);
  const camEast = centerEast - groundDistanceM * Math.sin(bearingRad);
  const camNorth = centerNorth - groundDistanceM * Math.cos(bearingRad);

  return {
    position: [camEast, Math.max(altitudeM, 10), -camNorth],
    fovDeg,
  };
}
