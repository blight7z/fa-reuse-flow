import type { NextConfig } from "next";

const upstream =
  process.env.INTERNAL_API_URL ?? process.env.API_UPSTREAM ?? process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${upstream}/api/:path*` },
      { source: "/health", destination: `${upstream}/health` },
      { source: "/ready", destination: `${upstream}/ready` },
    ];
  },
};

export default nextConfig;
