import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lighthouse (Best Practices) marca "missing source maps" en el JS de
  // producción sin esto; ayuda además a depurar errores reales reportados
  // desde producción.
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Solo sube source maps a Sentry si hay token de auth (build local sin
  // cuenta de Sentry configurada no debe fallar ni requerir login).
  silent: true,
  // Sin org/project ni SENTRY_AUTH_TOKEN el plugin se limita a inyectar el
  // runtime de Sentry y omite el upload de source maps (advertencia, no error).
  widenClientFileUpload: true,
});
