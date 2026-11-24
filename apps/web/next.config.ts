import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";
import { buildCsp } from "./lib/csp";

// En local (hors Vercel), lit le .env.local partagé à la racine du dépôt.
const rootEnv = resolve(import.meta.dirname, "../../.env.local");
if (!process.env.VERCEL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

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
  // Photos produits stockées dans Vercel Blob (EA03), optimisées par next/image.
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    const csp = buildCsp({
      dev: process.env.NODE_ENV === "development",
      preview: process.env.VERCEL_ENV === "preview",
      https: Boolean(process.env.VERCEL),
    });
    return [{ source: "/(.*)", headers: [{ key: "Content-Security-Policy", value: csp }] }];
  },
  async rewrites() {
    return localApi ? [{ source: "/api/v1/:path*", destination: `${localApi}/api/v1/:path*` }] : [];
  },
};

export default nextConfig;
