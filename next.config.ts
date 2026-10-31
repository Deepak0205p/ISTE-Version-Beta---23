import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdf-parse/pdfjs-dist must load from node_modules at runtime: bundled,
   * Turbopack drops `pdf.worker.mjs` ("Setting up fake worker failed").
   */
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
