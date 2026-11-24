import { z } from "zod";
import type { FulfillmentMode, OrderDto, OrderStatus } from "./order.js";

/** Transitions autorisées depuis le back-office (le passage à "payée" vient du paiement, jamais d'un admin). */
export function allowedTransitions(status: OrderStatus, fulfillment: FulfillmentMode): OrderStatus[] {
  switch (status) {
    case "PAID":
      return [fulfillment === "PICKUP" ? "READY_FOR_PICKUP" : "SHIPPED"];
    case "READY_FOR_PICKUP":
    case "SHIPPED":
      return ["COMPLETED"];
    default:
      return [];
  }
}

export const REFUNDABLE_STATUSES: OrderStatus[] = ["PAID", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED"];

export const ADMIN_PAGE_SIZE = 25;

export const adminOrderQuerySchema = z.object({
  statut: z.enum(["PENDING", "PAID", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED", "CANCELLED", "REFUNDED"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type AdminOrderQuery = z.infer<typeof adminOrderQuerySchema>;

export const orderStatusUpdateSchema = z.strictObject({
  status: z.enum(["READY_FOR_PICKUP", "SHIPPED", "COMPLETED"]),
});

export const adminProductQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>;

/** Adresse lisible d'un produit ou d'une catégorie : minuscules, chiffres, tirets. */
export const slugSchema = z
  .string()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: "Lien invalide : minuscules, chiffres et tirets seulement." });

/** "Gel Énergie Café" donne "gel-energie-cafe". */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

const productFields = {
  name: z.string().trim().min(1, { error: "Le nom est obligatoire." }).max(120),
  brand: z.string().trim().min(1, { error: "La marque est obligatoire." }).max(60),
  shortDescription: z.string().trim().min(1, { error: "L'accroche est obligatoire." }).max(160),
  description: z.string().trim().min(1, { error: "La description est obligatoire." }).max(4000),
  priceCents: z.number({ error: "Prix invalide." }).int().min(1, { error: "Prix invalide." }).max(10_000_00),
  categorySlugs: z.array(slugSchema).min(1, { error: "Choisissez au moins une catégorie." }).max(5),
};

/** Création d'un produit (EA03) : il naît en brouillon, sans variante ni image. */
export const productCreateSchema = z.strictObject({ ...productFields, slug: slugSchema.optional() });
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = z
  .strictObject({ ...productFields, status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: "Aucune modification." });
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/** Nouvelle variante (taille et coloris) ; son stock démarre à 0 dans chaque boutique. */
export const variantCreateSchema = z.strictObject({
  size: z.string().trim().min(1, { error: "La taille est obligatoire." }).max(20),
  color: z.string().trim().min(1, { error: "Le coloris est obligatoire." }).max(40),
});
export type VariantCreateInput = z.infer<typeof variantCreateSchema>;

const categoryFields = {
  name: z.string().trim().min(2, { error: "Le nom fait au moins 2 caractères." }).max(60),
  description: z.string().trim().min(1, { error: "La description est obligatoire." }).max(300),
  position: z.number().int().min(0).max(100),
};

export const categoryCreateSchema = z.strictObject({
  ...categoryFields,
  position: categoryFields.position.default(0),
  slug: slugSchema.optional(),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z
  .strictObject(categoryFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: "Aucune modification." });
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

/** Photos produit : formats web courants, 4 Mo au plus (limite des fonctions Vercel : 4,5 Mo). */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const IMAGES_PER_PRODUCT = 6;
export const imageUploadQuerySchema = z.object({
  alt: z.string().trim().min(3, { error: "Décrivez l'image en au moins 3 caractères." }).max(160),
});

export interface AdminCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  position: number;
  productCount: number;
}

export const stockUpdateSchema = z.strictObject({
  variantId: z.uuid(),
  storeSlug: z.string().regex(/^[a-z0-9-]{1,60}$/),
  quantity: z.number().int().min(0).max(9999),
  alertThreshold: z.number().int().min(0).max(100).optional(),
});
export type StockUpdateInput = z.infer<typeof stockUpdateSchema>;

export const API_SCOPES = ["catalog:read", "stock:read"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const apiKeyCreateSchema = z.strictObject({
  name: z.string().trim().min(2).max(60),
  scopes: z.array(z.enum(API_SCOPES)).min(1).max(API_SCOPES.length),
});
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;

export interface LowStockDto {
  productSlug: string;
  productName: string;
  variantLabel: string;
  storeName: string;
  available: number;
  alertThreshold: number;
}

export interface DashboardDto {
  revenueTodayCents: number;
  revenueMonthCents: number;
  ordersToProcess: number;
  pendingPayments: number;
  /** Nombre total de stocks sous leur seuil d'alerte (la liste n'en montre que 20). */
  lowStockCount: number;
  lowStock: LowStockDto[];
  recentOrders: AdminOrderDto[];
}

export interface AdminOrderDto extends OrderDto {
  customerEmail: string | null;
  shippingAddress: Record<string, string> | null;
  nextStatuses: OrderStatus[];
  refundable: boolean;
}

export interface AdminListDto<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

export interface AdminProductRowDto {
  id: string;
  slug: string;
  name: string;
  brand: string;
  priceCents: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  variantCount: number;
  totalAvailable: number;
}

export interface AdminProductDetailDto {
  id: string;
  slug: string;
  name: string;
  brand: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  categorySlugs: string[];
  images: { id: string; url: string; alt: string }[];
  stores: { slug: string; name: string }[];
  variants: {
    id: string;
    size: string;
    color: string;
    stocks: { storeSlug: string; quantity: number; reserved: number; alertThreshold: number }[];
  }[];
}

export interface AuditEntryDto {
  id: string;
  createdAt: string;
  actorEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
}

export interface ApiKeyDto {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKeyDto extends ApiKeyDto {
  /** Affichée une seule fois : seule son empreinte est stockée. */
  key: string;
}
