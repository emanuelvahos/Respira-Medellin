"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { gsap, ScrollTrigger, useRegisterScrollTrigger } from "@/hooks/useGsapScrollTrigger";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Sección de scroll-telling reutilizable: revela su contenido (opacidad +
 * desplazamiento) cuando entra al viewport, usando GSAP ScrollTrigger.
 *
 * Con `prefers-reduced-motion` activo, se omite el desplazamiento y el
 * contenido solo hace un fade de opacidad simple (sin `y` transform),
 * siguiendo la restricción de accesibilidad de la Fase 3.
 */
export function ScrollSection({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  useRegisterScrollTrigger();
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (reducedMotion) {
      // Transición simple de opacidad, sin desplazamiento ni scrub de cámara.
      gsap.set(el, { opacity: 0, y: 0 });
      const trigger = ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        end: "top 20%",
        onEnter: () => gsap.to(el, { opacity: 1, duration: 0.3, ease: "none" }),
        onLeaveBack: () => gsap.to(el, { opacity: 0, duration: 0.3, ease: "none" }),
      });
      return () => trigger.kill();
    }

    gsap.set(el, { opacity: 0, y: 48 });
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 78%",
      end: "top 35%",
      onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out" }),
      onLeaveBack: () => gsap.to(el, { opacity: 0, y: 48, duration: 0.4, ease: "power2.in" }),
    });

    return () => trigger.kill();
  }, [reducedMotion]);

  return (
    <section
      id={id}
      ref={ref}
      className={cn("flex min-h-dvh items-center py-24", className)}
    >
      {children}
    </section>
  );
}
