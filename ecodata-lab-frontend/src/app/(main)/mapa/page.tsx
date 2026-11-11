import type { Metadata } from "next";
import { MapaClient } from "@/components/map/MapaClient";

export const metadata: Metadata = {
  title: "Mapa 3D — Respira Medellín",
  description:
    "Mapa 3D inmersivo de arborización urbana y priorización de siembra para mitigar PM2.5 en Medellín.",
};

export default function MapaPage() {
  return <MapaClient />;
}
