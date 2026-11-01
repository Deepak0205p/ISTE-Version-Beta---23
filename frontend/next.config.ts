import type { NextConfig } from "next";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const INGESTION_URL = process.env.NEXT_PUBLIC_INGESTION_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${INGESTION_URL}/auth/:path*`,
      },
      {
        source: "/sync-statements/:path*",
        destination: `${INGESTION_URL}/sync-statements/:path*`,
      },
      {
        source: "/tax/:path*",
        destination: `${INGESTION_URL}/tax/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
    ];
  },
};

export default nextConfig;
