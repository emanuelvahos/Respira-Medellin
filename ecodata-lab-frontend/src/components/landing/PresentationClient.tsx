"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PresentationChartIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { HomeClient } from "@/components/landing/HomeClient";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Mismo orden/ids de `ScrollSection` que en `HomeClient` — el modo
 * presentación no inventa contenido nuevo, solo navega por estas mismas
 * secciones. */
const SECTION_IDS = [
  "intro",
  "correlacion",
  "metodologia-ahp",
  "recomendacion",
  "cta",
] as const;

/**
 * Recorrido de pantalla completa de la landing narrativa (Fase 3), pensado
 * para proyectar frente a la Secretaría: sin header/footer, navegable con
 * teclado, y reutilizando el mismo `HomeClient`/`ScrollSection` de scroll-
 * telling — las flechas solo disparan `scrollIntoView`, que a su vez activa
 * los mismos triggers de GSAP que el scroll normal.
 */
export function PresentationClient() {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const indexRef = useRef(0);

  const goToIndex = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(SECTION_IDS.length - 1, index));
      const el = document.getElementById(SECTION_IDS[clamped]);
      if (!el) return;
      el.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
      indexRef.current = clamped;
      setCurrentIndex(clamped);
    },
    [reducedMotion],
  );

  const exitPresentation = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    router.push("/");
  }, [router]);

  const start = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {
      // Algunos navegadores bloquean requestFullscreen fuera de ciertos
      // contextos; el modo presentación sigue funcionando sin pantalla
      // completa nativa (ya ocupa el 100% del viewport igual).
    });
    setStarted(true);
  }, []);

  // Bloquea el scroll de fondo mientras se muestra la pantalla de inicio.
  useEffect(() => {
    if (started) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [started]);

  useEffect(() => {
    if (!started) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        goToIndex(indexRef.current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToIndex(indexRef.current - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        exitPresentation();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [started, goToIndex, exitPresentation]);

  // Mantiene el indicador de progreso sincronizado también cuando el
  // presentador navega con scroll libre (mouse/trackpad), no solo teclado.
  useEffect(() => {
    if (!started) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = SECTION_IDS.indexOf(
          visible.target.id as (typeof SECTION_IDS)[number],
        );
        if (index !== -1) {
          indexRef.current = index;
          setCurrentIndex(index);
        }
      },
      { threshold: [0.5] },
    );

    for (const id of SECTION_IDS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [started]);

  return (
    <div className="bg-background">
      <HomeClient showPresentationEntry={false} />

      {started && (
        <>
          <div
            className="pointer-events-none fixed inset-y-0 right-3 z-[60] flex flex-col items-center justify-center gap-2"
            aria-hidden="true"
          >
            {SECTION_IDS.map((id, i) => (
              <span
                key={id}
                className={`size-1.5 rounded-full transition-colors ${
                  i === currentIndex ? "bg-foreground" : "bg-foreground/25"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={exitPresentation}
            aria-label="Salir del modo presentación"
            title="Salir (Esc)"
            className="fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] z-[60] flex size-9 pointer-coarse:size-11 items-center justify-center rounded-full bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <XIcon size={18} weight="bold" />
          </button>
        </>
      )}

      {!started && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-background/95 px-4 text-center backdrop-blur">
          <span className="flex size-14 items-center justify-center rounded-full bg-vegetation-muted text-vegetation">
            <PresentationChartIcon size={28} weight="bold" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              Modo presentación
            </h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Pantalla completa, sin menús. Navega con las flechas del
              teclado o la barra espaciadora, y sal con Esc.
            </p>
          </div>
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Iniciar presentación
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
