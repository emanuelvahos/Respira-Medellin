"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let pluginRegistered = false;

/** Registra ScrollTrigger una sola vez (no viene activo por defecto en gsap). */
export function useRegisterScrollTrigger(): void {
  useEffect(() => {
    if (!pluginRegistered) {
      gsap.registerPlugin(ScrollTrigger);
      pluginRegistered = true;
    }
  }, []);
}

export { gsap, ScrollTrigger };
