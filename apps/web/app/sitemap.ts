import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/catalog";

const ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

/**
 * sitemap.xml (SEO, critère 8) : pages publiques, catégories et toutes les fiches
 * produits publiées. Généré à la requête (l'API n'est pas joignable au build), à
 * partir des lectures du catalogue déjà mises en cache.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const pages: MetadataRoute.Sitemap = [
    { url: `${ORIGIN}/`, changeFrequency: "daily", priority: 1 },
    { url: `${ORIGIN}/produits`, changeFrequency: "daily", priority: 0.8 },
    { url: `${ORIGIN}/boutiques`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${ORIGIN}/confidentialite`, changeFrequency: "yearly", priority: 0.1 },
    { url: `${ORIGIN}/mentions-legales`, changeFrequency: "yearly", priority: 0.1 },
  ];
  try {
    const categories = await getCategories();
    for (const category of categories) {
      pages.push({ url: `${ORIGIN}/produits?categorie=${category.slug}`, changeFrequency: "weekly", priority: 0.7 });
    }
    const first = await getProducts({ page: 1, tri: "nouveautes" });
    const rest = await Promise.all(
      Array.from({ length: Math.min(first.totalPages, 50) - 1 }, (_, index) =>
        getProducts({ page: index + 2, tri: "nouveautes" }),
      ),
    );
    for (const product of [first, ...rest].flatMap((list) => list.items)) {
      pages.push({ url: `${ORIGIN}/produits/${product.slug}`, changeFrequency: "weekly", priority: 0.6 });
    }
  } catch {
    // API indisponible : on publie au moins les pages fixes.
  }
  return pages;
}
