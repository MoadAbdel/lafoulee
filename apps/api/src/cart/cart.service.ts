import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Redis } from "@upstash/redis";
import { MAX_QUANTITY_PER_LINE, type CartDto, type CartLineDto } from "@lafoulee/shared";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.constants.js";
import { redisKey } from "../redis/redis-key.js";

export const CART_TTL_SECONDS = 30 * 24 * 3600;

/** Contenu stocké : identifiant de variante -> quantité. Rien d'autre (prix et stock viennent de la base). */
export type CartItems = Record<string, number>;

/** Nombre d'articles différents dans un panier : borne la taille stockée dans Redis. */
const MAX_LINES = 30;

@Injectable()
export class CartService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  private key(cartId: string): string {
    return redisKey("cart", cartId);
  }

  async getItems(cartId: string | undefined): Promise<CartItems> {
    if (!cartId) return {};
    return (await this.redis.get<CartItems>(this.key(cartId))) ?? {};
  }

  /** Chaque modification prolonge la conservation du panier de 30 jours (EF04). */
  private async save(cartId: string, items: CartItems): Promise<void> {
    if (Object.keys(items).length === 0) await this.redis.del(this.key(cartId));
    else await this.redis.set(this.key(cartId), items, { ex: CART_TTL_SECONDS });
  }

  async setQuantity(cartId: string, variantId: string, quantity: number): Promise<CartDto> {
    // Map plutôt qu'objet : un identifiant reçu du client ne peut pas écrire une propriété
    // spéciale (__proto__, constructor...) de l'objet du panier.
    const lines = new Map(Object.entries(await this.getItems(cartId)));
    if (quantity === 0) {
      lines.delete(variantId);
    } else {
      const variant = await this.prisma.productVariant.findFirst({
        where: { id: variantId, product: { status: "PUBLISHED" } },
        include: { stocks: true },
      });
      if (!variant) throw new NotFoundException("Produit introuvable.");
      if (!lines.has(variantId) && lines.size >= MAX_LINES) {
        throw new BadRequestException(`Votre panier contient déjà ${MAX_LINES} articles différents.`);
      }
      const available = variant.stocks.reduce((sum, stock) => sum + Math.max(0, stock.quantity - stock.reserved), 0);
      if (available === 0) throw new BadRequestException("Cette taille est en rupture de stock.");
      lines.set(variantId, Math.min(quantity, available, MAX_QUANTITY_PER_LINE));
    }
    const items: CartItems = Object.fromEntries(lines);
    await this.save(cartId, items);
    return this.toDto(items);
  }

  async clear(cartId: string | undefined): Promise<void> {
    if (cartId) await this.redis.del(this.key(cartId));
  }

  async view(cartId: string | undefined): Promise<CartDto> {
    return this.toDto(await this.getItems(cartId));
  }

  /** Recalcule le panier depuis la base : un produit retiré du catalogue disparaît du panier. */
  async toDto(items: CartItems): Promise<CartDto> {
    const ids = Object.keys(items);
    if (ids.length === 0) return { lines: [], itemCount: 0, subtotalCents: 0, pickupStoreSlugs: [] };
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: ids }, product: { status: "PUBLISHED" } },
      include: { product: true, stocks: { include: { store: { select: { slug: true } } } } },
    });
    const lines: CartLineDto[] = variants
      .map((variant) => {
        const quantity = items[variant.id] ?? 0;
        const unitPriceCents = variant.priceCentsOverride ?? variant.product.priceCents;
        return {
          variantId: variant.id,
          productSlug: variant.product.slug,
          productName: variant.product.name,
          brand: variant.product.brand,
          size: variant.size,
          color: variant.color,
          unitPriceCents,
          quantity,
          lineTotalCents: unitPriceCents * quantity,
          available: variant.stocks.reduce((sum, stock) => sum + Math.max(0, stock.quantity - stock.reserved), 0),
        };
      })
      .sort((a, b) => a.productName.localeCompare(b.productName) || a.size.localeCompare(b.size));
    // Retrait : une boutique n'est proposée que si elle a toutes les lignes en quantité suffisante
    // (la réservation à la commande reste la vérification qui fait foi).
    const perStore = variants.map(
      (variant) =>
        new Set(
          variant.stocks
            .filter((stock) => stock.quantity - stock.reserved >= (items[variant.id] ?? 0))
            .map((stock) => stock.store.slug),
        ),
    );
    const pickupStoreSlugs =
      perStore.length === 0 ? [] : [...perStore[0]!].filter((slug) => perStore.every((set) => set.has(slug))).sort();
    return {
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      subtotalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
      pickupStoreSlugs,
    };
  }
}
