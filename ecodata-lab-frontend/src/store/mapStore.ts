import { create } from "zustand";

/** Centro aproximado de Medellín, con inclinación para dar sensación 3D desde el inicio. */
export const INITIAL_VIEW_STATE = {
  longitude: -75.5812,
  latitude: 6.2442,
  zoom: 11,
  pitch: 45,
  bearing: 0,
} as const;

export type MapViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

export type MapLayerId =
  | "comunas"
  | "zonasSiembra"
  | "zonasVerdes"
  | "pm25"
  | "arbolesSau"
  | "estacionesPm25";

/**
 * Estilo base del mapa Mapbox. "satellite" (imagen satelital real) existe
 * como herramienta de auditoría visual rápida — Fase D: al marcar una zona
 * de siembra como `posible_no_viable` (se solapa con una cancha/plaza según
 * el inventario de GeoMedellín), el panel de esa zona ofrece un atajo que
 * cambia a este estilo y centra la cámara ahí, para verificar a simple
 * vista si en efecto es una superficie no sembrable. También accesible
 * manualmente desde `MapLayerToggles` para cualquier otro uso.
 */
export type MapStyle = "dark" | "satellite";

export const MAP_STYLE_URLS: Record<MapStyle, string> = {
  dark: "mapbox://styles/mapbox/dark-v11",
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
};

/**
 * Zoom a partir del cual la capa de árboles del SAU cambia de clusters (grid
 * agregado) a puntos individuales reales por viewport — mismo patrón visual
 * que el propio visor del SAU al acercar el mapa. Por debajo de este umbral,
 * pedir puntos individuales devolvería demasiados árboles por celda de
 * pantalla; por encima, el bbox del viewport ya acota lo suficiente.
 */
export const ARBOLES_SAU_PUNTOS_MIN_ZOOM = 15;

export type MapLayerToggles = Record<MapLayerId, boolean>;

/** Zoom/pitch/bearing fijos usados al volar a una comuna seleccionada
 * ("flyTo"): un acercamiento a nivel de calle con inclinación 3D, para dar
 * contexto real del terreno de la comuna (Fase 3; el zoom se mantuvo igual
 * en Fase F3 al remover los árboles 3D que originalmente motivaron este
 * nivel de acercamiento — sigue siendo una buena experiencia por sí sola). */
export const COMUNA_FLYTO_ZOOM = 17.8;
export const COMUNA_FLYTO_PITCH = 60;
export const COMUNA_FLYTO_BEARING = 0;

/** Zoom/pitch/bearing usados por la búsqueda de direcciones (`AddressSearch`):
 * un poco más alejado que el flyTo de comuna porque el punto buscado es una
 * dirección puntual, no una comuna completa — no hace falta acercarse tanto
 * para ubicarla en contexto de calle. */
export const ADDRESS_FLYTO_ZOOM = 16.5;
export const ADDRESS_FLYTO_PITCH = 45;
export const ADDRESS_FLYTO_BEARING = 0;

/**
 * Límites de paneo/zoom del mapa, derivados del bounding box real de
 * `limite_catastral_de_comun.geojson` (las 21 comunas/corregimientos):
 * lng [-75.7193, -75.4719], lat [6.1629, 6.3749]. Se les da ~15-20% de
 * margen para que el usuario tenga "aire" alrededor de la ciudad sin poder
 * alejarse a ver medio país.
 */
export const MEDELLIN_MAX_BOUNDS: [[number, number], [number, number]] = [
  [-75.8, 6.09],
  [-75.39, 6.45],
];

/**
 * `minZoom`: nivel en el que el área acotada (`MEDELLIN_MAX_BOUNDS`) apenas
 * llena el viewport, calculado con la fórmula estándar de tiles Web Mercator
 * (pixeles_por_grado = 256*2^zoom/360) contra un viewport de referencia
 * ~1280x800px. Zoom por debajo de este valor solo agregaría espacio vacío
 * fuera del área de interés, así que se usa como tope de alejamiento.
 * `maxZoom`: por encima de `COMUNA_FLYTO_ZOOM` (17.8, usado por el flyTo de
 * comuna), para permitir algo de inspección de detalle adicional sin
 * bloquear el flyTo.
 */
export const MEDELLIN_MIN_ZOOM = 10.5;
export const MEDELLIN_MAX_ZOOM = 19;

/** Marcador temporal dejado por `AddressSearch` en el punto buscado. */
export type SearchMarker = {
  longitude: number;
  latitude: number;
  placeName: string;
} | null;

type MapState = {
  selectedComuna: string | null;
  hoveredComuna: string | null;
  layers: MapLayerToggles;
  viewState: MapViewState;
  particlesPaused: boolean;
  /** true mientras dura la animación flyTo hacia la comuna seleccionada. */
  isFlyingTo: boolean;
  searchMarker: SearchMarker;
  mapStyle: MapStyle;
  /**
   * Fase E1: por defecto `false` — las zonas `posible_no_viable` (auditoría
   * de Fase D) quedan fuera de la recomendación activa que se ve en el mapa.
   * No es un toggle de capa independiente (`MapLayerId`): solo tiene efecto
   * mientras `layers.zonasSiembra` ya está activa, así que vive como su
   * propio campo en vez de mezclarse con `layers`.
   */
  mostrarZonasDescartadas: boolean;
  /**
   * Refleja (no gobierna) si `ZonaSiembraDetailPanel` está abierto —
   * ese panel vive como estado local de `MapCanvas` a propósito (no debe
   * afectar URL/dashboard, ver comentario ahí), pero `MapLegend` necesita
   * saber si está abierto para no dibujarse debajo/encima de él: ambos
   * anclan a la esquina inferior y se solapan visualmente en pantallas
   * angostas (<~640px) o cuando el contenido de la leyenda es alto.
   */
  zonaSiembraPanelAbierto: boolean;
  setSelectedComuna: (comuna: string | null) => void;
  setHoveredComuna: (comuna: string | null) => void;
  toggleLayer: (layer: MapLayerId) => void;
  setViewState: (viewState: MapViewState) => void;
  toggleParticlesPaused: () => void;
  toggleMostrarZonasDescartadas: () => void;
  setIsFlyingTo: (flying: boolean) => void;
  setSearchMarker: (marker: SearchMarker) => void;
  setMapStyle: (style: MapStyle) => void;
  toggleMapStyle: () => void;
  setZonaSiembraPanelAbierto: (abierto: boolean) => void;
};

export const useMapStore = create<MapState>((set) => ({
  selectedComuna: null,
  hoveredComuna: null,
  layers: {
    comunas: true,
    zonasSiembra: true,
    // 48.348 polígonos (~23MB tras simplificar): apagada por defecto para no
    // descargarla en el primer render de /mapa; el usuario la activa a
    // conciencia desde el toggle.
    zonasVerdes: false,
    pm25: false,
    // 339.724 árboles reales (SAU): apagada por defecto, igual que
    // zonas-verdes — se activa a conciencia desde el toggle (`MapLayerToggles`),
    // y siempre carga primero en modo clustered (liviano, `arbolesSauZoomCercano`
    // en `MapCanvas`), nunca los puntos crudos, hasta acercar el zoom lo
    // suficiente. Toggle independiente desde Fase F3 (antes lo controlaba
    // `TreeModeSelector`, removido junto con los árboles 3D).
    arbolesSau: false,
    // Encendida por defecto: son pocas estaciones reales (SIATA), el dato ya
    // se pide sin condicionar a este toggle (alimenta las partículas PM2.5),
    // y es justamente lo que responde "¿por qué esta comuna tiene PM2.5
    // estimado/histórico?" a simple vista en el mapa.
    estacionesPm25: true,
  },
  viewState: INITIAL_VIEW_STATE,
  particlesPaused: false,
  isFlyingTo: false,
  searchMarker: null,
  mapStyle: "dark",
  mostrarZonasDescartadas: false,
  zonaSiembraPanelAbierto: false,
  setSelectedComuna: (comuna) =>
    set({
      selectedComuna: comuna,
      isFlyingTo: comuna !== null,
    }),
  setHoveredComuna: (comuna) => set({ hoveredComuna: comuna }),
  toggleLayer: (layer) =>
    set((state) => ({
      layers: { ...state.layers, [layer]: !state.layers[layer] },
    })),
  setViewState: (viewState) => set({ viewState }),
  toggleParticlesPaused: () =>
    set((state) => ({ particlesPaused: !state.particlesPaused })),
  toggleMostrarZonasDescartadas: () =>
    set((state) => ({ mostrarZonasDescartadas: !state.mostrarZonasDescartadas })),
  setIsFlyingTo: (flying) => set({ isFlyingTo: flying }),
  setSearchMarker: (marker) => set({ searchMarker: marker }),
  setMapStyle: (style) => set({ mapStyle: style }),
  toggleMapStyle: () =>
    set((state) => ({ mapStyle: state.mapStyle === "dark" ? "satellite" : "dark" })),
  setZonaSiembraPanelAbierto: (abierto) => set({ zonaSiembraPanelAbierto: abierto }),
}));
