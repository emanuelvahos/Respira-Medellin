import type { Metadata } from "next";
import { PresentationClient } from "@/components/landing/PresentationClient";

export const metadata: Metadata = {
  title: "Modo presentación — Respira Medellín",
  description:
    "Recorrido de pantalla completa de la landing narrativa, pensado para proyectar en vivo.",
};

export default function PresentacionPage() {
  return <PresentationClient />;
}
