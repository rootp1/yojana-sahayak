import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The scheme database is read from disk at runtime; make sure it ships with every function.
  outputFileTracingIncludes: {
    "/**": ["./data/schemes.json"],
  },
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
