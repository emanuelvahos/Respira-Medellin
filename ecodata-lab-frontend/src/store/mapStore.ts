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

export type MapLayerId = "comunas" | "zonasSiembra" | "zonasVerdes" | "pm25";

export type MapLayerToggles = Record<MapLayerId, boolean>;

/** Zoom/pitch/bearing fijos usados por "Respiro Urbano" al volar a una comuna.
 *
 * El zoom debe ser lo bastante cercano para que los árboles 3D (troncos de
 * ~4m, copas de ~6m) ocupen más de un puñado de píxeles: a zoom 15.5 la
 * resolución en el suelo es ~3.4 m/px y una copa de 6m es ~1-2px, invisible
 * en la práctica aunque la cámara y los datos estén correctos.
 */
export const COMUNA_FLYTO_ZOOM = 17.8;
export const COMUNA_FLYTO_PITCH = 60;
export const COMUNA_FLYTO_BEARING = 0;

type MapState = {
  selectedComuna: string | null;
  hoveredComuna: string | null;
  layers: MapLayerToggles;
  viewState: MapViewState;
  particlesPaused: boolean;
  /** true mientras dura la animación flyTo hacia la comuna seleccionada. */
  isFlyingTo: boolean;
  /** true una vez el flyTo termina: dispara la revelación de TreeInstances. */
  treesRevealed: boolean;
  setSelectedComuna: (comuna: string | null) => void;
  setHoveredComuna: (comuna: string | null) => void;
  toggleLayer: (layer: MapLayerId) => void;
  setViewState: (viewState: MapViewState) => void;
  toggleParticlesPaused: () => void;
  setIsFlyingTo: (flying: boolean) => void;
  setTreesRevealed: (revealed: boolean) => void;
};

export const useMapStore = create<MapState>((set) => ({
  selectedComuna: null,
  hoveredComuna: null,
  layers: {
    comunas: true,
    zonasSiembra: true,
    zonasVerdes: true,
    pm25: false,
  },
  viewState: INITIAL_VIEW_STATE,
  particlesPaused: false,
  isFlyingTo: false,
  treesRevealed: false,
  setSelectedComuna: (comuna) =>
    set({
      selectedComuna: comuna,
      treesRevealed: false,
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
  setIsFlyingTo: (flying) => set({ isFlyingTo: flying }),
  setTreesRevealed: (revealed) => set({ treesRevealed: revealed }),
}));
