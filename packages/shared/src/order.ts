import { z } from "zod";
import { emailSchema } from "./auth.js";

/** Livraison offerte à partir de ce montant (dossier, C23 : levier de monétisation). */
export const FREE_SHIPPING_THRESHOLD_CENTS = 6000;
export const SHIPPING_CENTS = 490;
export const MAX_QUANTITY_PER_LINE = 10;
/** Durée de réservation du stock pendant le paiement. */
export const RESERVATION_MINUTES = 30;

export type FulfillmentMode = "PICKUP" | "DELIVERY";

/** Même calcul côté site (affichage) et côté API (montant réellement payé). */
export function computeTotals(subtotalCents: number, fulfillment: FulfillmentMode) {
  const shippingCents =
    fulfillment === "PICKUP" || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS || subtotalCents === 0
      ? 0
      : SHIPPING_CENTS;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}

export const cartItemSchema = z.strictObject({
  variantId: z.uuid(),
  quantity: z.number().int().min(0).max(MAX_QUANTITY_PER_LINE),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export interface CartLineDto {
  variantId: string;
  productSlug: string;
  productName: string;
  brand: string;
  size: string;
  color: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  /** Stock disponible toutes boutiques confondues. */
  available: number;
}

export interface CartDto {
  lines: CartLineDto[];
  itemCount: number;
  subtotalCents: number;
  /** Boutiques où tout le panier est disponible tout de suite : seules proposées pour le retrait. */
  pickupStoreSlugs: string[];
}

export const addressSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(100),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional(),
  postalCode: z.string().regex(/^\d{5}$/, { error: "Code postal à 5 chiffres." }),
  city: z.string().trim().min(1).max(100),
});
export type AddressInput = z.infer<typeof addressSchema>;

/** Commande : retrait en boutique ou livraison. L'email n'est demandé qu'aux visiteurs sans compte. */
export const checkoutSchema = z.discriminatedUnion("fulfillment", [
  z.strictObject({
    fulfillment: z.literal("PICKUP"),
    pickupStoreSlug: z.string().regex(/^[a-z0-9-]{1,60}$/),
    email: emailSchema.optional(),
  }),
  z.strictObject({
    fulfillment: z.literal("DELIVERY"),
    address: addressSchema,
    email: emailSchema.optional(),
  }),
]);
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export interface CreateOrderResult {
  orderId: string;
  number: number;
  accessToken: string;
  clientSecret: string;
  totalCents: number;
}

export type OrderStatus = "PENDING" | "PAID" | "READY_FOR_PICKUP" | "SHIPPED" | "COMPLETED" | "CANCELLED" | "REFUNDED";

export interface OrderLineDto {
  productName: string;
  variantLabel: string;
  unitPriceCents: number;
  quantity: number;
}

export interface OrderDto {
  id: string;
  number: number;
  status: OrderStatus;
  fulfillment: FulfillmentMode;
  pickupStoreName: string | null;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  lines: OrderLineDto[];
}

export const orderAccessSchema = z.object({ jeton: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
