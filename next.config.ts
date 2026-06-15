import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: no debe pasar por el bundler de Next,
  // o el binario .node no se resuelve en producción.
  serverExternalPackages: ["better-sqlite3"],

  // Orígenes permitidos para peticiones a recursos de desarrollo (HMR, etc.)
  // cuando se entra por el dominio de DuckDNS en lugar de localhost.
  allowedDevOrigins: ["*.duckdns.org"],

  images: {
    // Permite servir las portadas remotas de Spotify a través de next/image.
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
    ],
  },
};

export default nextConfig;
