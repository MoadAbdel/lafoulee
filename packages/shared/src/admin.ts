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

export const productUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    brand: z.string().trim().min(1).max(60),
    shortDescription: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(4000),
    priceCents: z.number().int().min(1).max(10_000_00),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { error: "Aucune modification." });
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

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
