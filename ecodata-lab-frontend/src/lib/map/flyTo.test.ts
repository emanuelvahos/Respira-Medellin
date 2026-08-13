import { describe, expect, it, vi } from "vitest";
import { flyTo, type FlyToTarget } from "./flyTo";
import type { MapViewState } from "@/store/mapStore";

const TARGET: FlyToTarget = {
  longitude: -75.5636,
  latitude: 6.2518,
  zoom: 13,
  pitch: 45,
  bearing: 0,
};

describe("flyTo", () => {
  it("sets a viewState carrying the target coords plus a transition when motion is allowed", () => {
    const setViewState = vi.fn<(viewState: MapViewState) => void>();
    const duration = flyTo(setViewState, TARGET, false);

    expect(duration).toBe(1800);
    expect(setViewState).toHaveBeenCalledTimes(1);
    const arg = setViewState.mock.calls[0][0] as MapViewState & {
      transitionDuration: number;
      transitionInterpolator: unknown;
    };
    expect(arg.longitude).toBe(TARGET.longitude);
    expect(arg.latitude).toBe(TARGET.latitude);
    expect(arg.zoom).toBe(TARGET.zoom);
    expect(arg.pitch).toBe(TARGET.pitch);
    expect(arg.bearing).toBe(TARGET.bearing);
    expect(arg.transitionDuration).toBe(1800);
    expect(arg.transitionInterpolator).toBeDefined();
  });

  it("returns a duration of 0 and skips the animated transition when reducedMotion is true", () => {
    const setViewState = vi.fn<(viewState: MapViewState) => void>();
    const duration = flyTo(setViewState, TARGET, true);

    expect(duration).toBe(0);
    const arg = setViewState.mock.calls[0][0] as MapViewState & { transitionDuration: number };
    expect(arg.transitionDuration).toBe(0);
  });

  it("returns the same duration it applies to the viewState, so callers can schedule post-flight work", () => {
    const setViewState = vi.fn<(viewState: MapViewState) => void>();
    const duration = flyTo(setViewState, TARGET, false);
    const arg = setViewState.mock.calls[0][0] as MapViewState & { transitionDuration: number };
    expect(duration).toBe(arg.transitionDuration);
  });
});
