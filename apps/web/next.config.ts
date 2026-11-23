import type { NextConfig } from "next";

/**
 * En local, `npm run dev:web` et `npm run dev:api` tournent séparément :
 * /api/v1/* est alors renvoyé vers l'API NestJS (port 4000).
 * Sur Vercel, ce sont les rewrites de vercel.json qui routent vers le service api.
 */
const localApi = process.env.API_DEV_URL;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return localApi ? [{ source: "/api/v1/:path*", destination: `${localApi}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
