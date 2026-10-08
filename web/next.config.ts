import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Live ledger dashboard: everything is request-time / client-driven, nothing to cache.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
