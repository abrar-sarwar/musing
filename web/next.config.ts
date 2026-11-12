import type { NextConfig } from "next";

// prototype: everything is dynamic (cookie-based acting user, live db reads),
// so cache components stay off. keeps every page a plain server render.
const nextConfig: NextConfig = {
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
