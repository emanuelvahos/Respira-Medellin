import type { NextConfig } from "next";

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

export default nextConfig;
