import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Build "standalone" pour Docker — produit .next/standalone/server.js + minimal node_modules
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd()),
  turbopack: {
    root: path.join(process.cwd()),
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
