import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard — Respira Medellín",
  description:
    "Dashboard analítico de arborización urbana y PM2.5: KPIs, gráficas por comuna y comparador de escenarios AHP.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
