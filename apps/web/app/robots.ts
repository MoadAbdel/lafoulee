import type { MetadataRoute } from "next";

const ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

/** robots.txt (SEO, critère 9) : espaces privés et API exclus de l'indexation. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/compte", "/commande", "/panier", "/api/"] }],
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}
