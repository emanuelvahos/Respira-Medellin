"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { MagnifyingGlassIcon, MapPinIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { searchMedellinPlaces, type GeocodingFeature } from "@/lib/map/geocoding";
import { flyTo } from "@/lib/map/flyTo";
import {
  ADDRESS_FLYTO_BEARING,
  ADDRESS_FLYTO_PITCH,
  ADDRESS_FLYTO_ZOOM,
  MEDELLIN_MAX_BOUNDS,
  useMapStore,
} from "@/store/mapStore";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

type Status = "idle" | "loading" | "success" | "empty" | "error";

/**
 * Búsqueda de direcciones/barrios en Medellín (Mapbox Geocoding, mismo token
 * público que `MapCanvas`). Vuela la cámara con el mismo helper `flyTo` que
 * usa `MapCanvas` al seleccionar una comuna — no hay una tercera
 * implementación paralela de la animación de cámara.
 */
export function AddressSearch() {
  const setViewState = useMapStore((s) => s.setViewState);
  const setSearchMarker = useMapStore((s) => s.setSearchMarker);
  const reducedMotion = usePrefersReducedMotion();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);

  useEffect(() => {
    // El caso "consulta muy corta" y el estado "loading" ya se resuelven en
    // el `onChange` del input (reset/loading inmediatos, sin esperar el
    // debounce): para cuando este efecto ve un `debouncedQuery` válido,
    // `status` ya está en "loading". Evita llamar `setState` sincrónicamente
    // en el cuerpo del efecto (regla `react-hooks/set-state-in-effect`) —
    // solo se llama `setState` dentro de los callbacks async de abajo.
    if (debouncedQuery.length < MIN_QUERY_LENGTH) return;

    const controller = new AbortController();

    searchMedellinPlaces(debouncedQuery, MEDELLIN_MAX_BOUNDS, controller.signal)
      .then((results) => {
        setSuggestions(results);
        setActiveIndex(-1);
        setStatus(results.length ? "success" : "empty");
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const selectSuggestion = (feature: GeocodingFeature) => {
    const [longitude, latitude] = feature.center;
    flyTo(
      setViewState,
      {
        longitude,
        latitude,
        zoom: ADDRESS_FLYTO_ZOOM,
        pitch: ADDRESS_FLYTO_PITCH,
        bearing: ADDRESS_FLYTO_BEARING,
      },
      reducedMotion,
    );
    setSearchMarker({ longitude, latitude, placeName: feature.placeName });
    setQuery(feature.placeName);
    setSuggestions([]);
    setStatus("idle");
    setOpen(false);
    inputRef.current?.blur();
  };

  const clearSearch = () => {
    setQuery("");
    setSuggestions([]);
    setStatus("idle");
    setOpen(false);
    setSearchMarker(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (!open || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
      }
    }
  };

  const showDropdown = open && debouncedQuery.length >= MIN_QUERY_LENGTH && status !== "idle";

  return (
    <div className="absolute inset-x-4 top-4 z-30 mx-auto max-w-md">
      <div className="relative rounded-lg border border-border bg-card/95 shadow-md backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2">
          <MagnifyingGlassIcon
            size={18}
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="address-search-listbox"
            aria-activedescendant={
              activeIndex >= 0 ? `address-search-option-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-label="Buscar dirección o barrio en Medellín"
            placeholder="Buscar dirección o barrio…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              setQuery(value);
              setOpen(true);
              if (value.trim().length < MIN_QUERY_LENGTH) {
                setSuggestions([]);
                setStatus("idle");
              } else {
                // Optimista: se sabe que se va a buscar en cuanto el
                // debounce asiente, así que el spinner aparece de inmediato
                // en vez de esperar los DEBOUNCE_MS antes de mostrar "loading".
                setStatus("loading");
              }
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpiar búsqueda"
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon size={16} />
            </button>
          )}
        </div>

        {showDropdown && (
          <ul
            id="address-search-listbox"
            role="listbox"
            aria-label="Sugerencias de búsqueda"
            className="max-h-64 overflow-y-auto border-t border-border p-1 text-sm"
          >
            {status === "loading" && (
              <li className="px-3 py-2 text-muted-foreground">Buscando…</li>
            )}
            {status === "empty" && (
              <li className="px-3 py-2 text-muted-foreground">
                Sin resultados en Medellín para &quot;{debouncedQuery}&quot;.
              </li>
            )}
            {status === "error" && (
              <li className="px-3 py-2 text-critical">
                No se pudo buscar. Intenta de nuevo.
              </li>
            )}
            {status === "success" &&
              suggestions.map((feature, i) => (
                <li
                  key={feature.id}
                  id={`address-search-option-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`flex cursor-pointer items-start gap-2 rounded-md px-3 py-2 ${
                    i === activeIndex
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground hover:bg-secondary/60"
                  }`}
                  onMouseEnter={() => setActiveIndex(i)}
                  onMouseDown={(e) => {
                    // Evita que el input pierda foco (onBlur) antes de que
                    // el click en la sugerencia llegue a ejecutarse.
                    e.preventDefault();
                  }}
                  onClick={() => selectSuggestion(feature)}
                >
                  <MapPinIcon
                    size={16}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>{feature.placeName}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
