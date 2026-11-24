import { z } from "zod";

export const PRODUCT_SORTS = ["pertinence", "nouveautes", "prix-croissant", "prix-decroissant"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PAGE_SIZE = 12;

/**
 * Paramètres de la liste des produits : bornes explicites. Les paramètres
 * inconnus (utm_source, etc.) sont ignorés, pas rejetés, pour ne pas casser
 * les liens de campagne.
 */
export const productListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categorie: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  tri: z.enum(PRODUCT_SORTS).optional(),
  /** Seulement les produits disponibles tout de suite dans cette boutique (slug). */
  boutique: z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const slugParamSchema = z.string().regex(/^[a-z0-9-]{1,100}$/);

export interface CategoryDto {
  slug: string;
  name: string;
  description: string;
}

export interface StoreDto {
  slug: string;
  name: string;
  address: string;
  postalCode: string;
  city: string;
  openingHours: string;
}

export interface ProductCardDto {
  slug: string;
  name: string;
  brand: string;
  shortDescription: string;
  /** Prix le plus bas parmi les variantes, en centimes. */
  fromPriceCents: number;
  inStock: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
}

export interface ProductListDto {
  items: ProductCardDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VariantStockDto {
  storeSlug: string;
  available: number;
}

export interface VariantDto {
  id: string;
  sku: string;
  size: string;
  color: string;
  priceCents: number;
  stocks: VariantStockDto[];
  /** Somme des quantités disponibles dans toutes les boutiques. */
  totalAvailable: number;
}

export interface ProductDetailDto {
  slug: string;
  name: string;
  brand: string;
  shortDescription: string;
  description: string;
  attributes: Record<string, string>;
  categories: CategoryDto[];
  /** color : coloris montré (null : photo commune). La fiche affiche la photo du coloris choisi. */
  images: { url: string; alt: string; color: string | null }[];
  variants: VariantDto[];
  stores: StoreDto[];
}
