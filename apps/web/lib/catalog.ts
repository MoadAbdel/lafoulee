import { cacheLife, cacheTag } from "next/cache";
import type { CategoryDto, ProductDetailDto, ProductListDto, ProductListQuery, StoreDto } from "@lafoulee/shared";
import { getJson } from "./api";

/**
 * Lectures du catalogue mises en cache par Next.js (équivalent de l'ISR) :
 * résultat gardé quelques minutes, étiqueté "catalog" pour une invalidation
 * immédiate quand l'administration modifie un produit (étape back-office).
 * Ces fonctions ne sont appelées qu'au moment d'une requête, jamais au build :
 * l'API n'est joignable qu'à l'exécution.
 */

export async function getCategories(): Promise<CategoryDto[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return (await getJson<CategoryDto[]>("/categories")) ?? [];
}

export async function getStores(): Promise<StoreDto[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return (await getJson<StoreDto[]>("/stores")) ?? [];
}

export async function getProducts(query: ProductListQuery): Promise<ProductListDto> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.q) params.set("q", query.q);
  if (query.categorie) params.set("categorie", query.categorie);
  if (query.tri) params.set("tri", query.tri);
  const list = await getJson<ProductListDto>(`/products?${params.toString()}`);
  return list ?? { items: [], page: query.page, pageSize: 12, total: 0, totalPages: 1 };
}

export async function getProduct(slug: string): Promise<ProductDetailDto | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", `product:${slug}`);
  return getJson<ProductDetailDto>(`/products/${encodeURIComponent(slug)}`);
}
