import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import {
  computeTotals,
  RESERVATION_MINUTES,
  type CheckoutInput,
  type CreateOrderResult,
  type OrderDto,
} from "@lafoulee/shared";
import { randomToken, sha256 } from "../common/crypto.js";
import { CartService } from "../cart/cart.service.js";
import { CATALOG_CACHE } from "../catalog/catalog.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CacheService } from "../redis/cache.service.js";
import { StripeGateway } from "../payments/stripe.gateway.js";
import { OrderEventsPublisher } from "../notifications/order-events.publisher.js";
import type { Prisma } from "../generated/prisma/client.js";
import { StockService, type Allocation } from "./stock.service.js";

type OrderWithDetails = Prisma.OrderGetPayload<{ include: { lines: true; pickupStore: true } }>;

function allocationsOf(order: {
  lines: { variantId: string; storeId: string | null; quantity: number }[];
}): Allocation[] {
  return order.lines.flatMap((line) =>
    line.storeId ? [{ variantId: line.variantId, storeId: line.storeId, quantity: line.quantity }] : [],
  );
}

export function toOrderDto(order: OrderWithDetails): OrderDto {
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    fulfillment: order.fulfillment,
    pickupStoreName: order.pickupStore?.name ?? null,
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    createdAt: order.createdAt.toISOString(),
    lines: order.lines.map((line) => ({
      productName: line.productName,
      variantLabel: line.variantLabel,
      unitPriceCents: line.unitPriceCents,
      quantity: line.quantity,
    })),
  };
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly stock: StockService,
    private readonly stripe: StripeGateway,
    private readonly events: OrderEventsPublisher,
    private readonly cache: CacheService,
  ) {}

  /**
   * Création de commande (EF05, EF06) : prix lus en base, stock réservé dans une
   * transaction, puis paiement Stripe créé avec le montant calculé ici.
   */
  async create(cartId: string | undefined, userId: string | null, input: CheckoutInput): Promise<CreateOrderResult> {
    const cart = await this.cart.view(cartId);
    if (cart.lines.length === 0) throw new BadRequestException("Votre panier est vide.");

    const user = userId ? await this.prisma.user.findUnique({ where: { id: userId } }) : null;
    const email = user?.email ?? input.email;
    if (!email) throw new UnprocessableEntityException("Indiquez une adresse email pour recevoir la confirmation.");

    let pickupStoreId: string | null = null;
    if (input.fulfillment === "PICKUP") {
      const store = await this.prisma.store.findUnique({ where: { slug: input.pickupStoreSlug } });
      if (!store) throw new BadRequestException("Boutique inconnue.");
      pickupStoreId = store.id;
    }

    // Libère d'abord les paiements abandonnés : leur stock redevient disponible.
    await this.expireAbandoned(20);

    const totals = computeTotals(cart.subtotalCents, input.fulfillment);
    const accessToken = randomToken();
    const order = await this.prisma.$transaction(async (tx) => {
      const allocations = await this.stock.reserve(
        tx,
        cart.lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          label: `${line.productName} (${line.size}, ${line.color})`,
        })),
        pickupStoreId,
      );
      const byVariant = new Map(cart.lines.map((line) => [line.variantId, line]));
      return tx.order.create({
        data: {
          userId: user?.id ?? null,
          guestEmail: user ? null : email,
          fulfillment: input.fulfillment,
          pickupStoreId,
          shippingAddress: input.fulfillment === "DELIVERY" ? input.address : undefined,
          ...totals,
          accessTokenHash: sha256(accessToken),
          lines: {
            create: allocations.map((allocation) => {
              const line = byVariant.get(allocation.variantId)!;
              return {
                variantId: allocation.variantId,
                storeId: allocation.storeId,
                productName: `${line.brand} ${line.productName}`,
                variantLabel: `${line.size}, ${line.color}`,
                unitPriceCents: line.unitPriceCents,
                quantity: allocation.quantity,
              };
            }),
          },
        },
        include: { lines: true },
      });
    });
    await this.cache.invalidate(CATALOG_CACHE); // le stock disponible a changé

    try {
      const intent = await this.stripe.createPaymentIntent(order.id, order.totalCents, email);
      await this.prisma.payment.create({
        data: { orderId: order.id, stripePaymentIntentId: intent.id, amountCents: order.totalCents },
      });
      return {
        orderId: order.id,
        number: order.number,
        accessToken,
        clientSecret: intent.clientSecret,
        totalCents: order.totalCents,
      };
    } catch (error) {
      this.logger.error(`Création du paiement impossible pour la commande ${order.id} : ${String(error)}`);
      await this.cancel(order.id);
      throw new BadGatewayException("Le paiement est momentanément indisponible. Réessayez.");
    }
  }

  /**
   * Passage à "payée", une seule fois quelle que soit la source (webhook ou
   * vérification depuis la page de confirmation) : la transition PENDING -> PAID
   * est conditionnelle. Renvoie true si c'est cet appel qui l'a faite.
   */
  async markPaid(orderId: string): Promise<boolean> {
    const done = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "PAID" },
      });
      if (count === 0) return false;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
      await this.stock.commit(tx, allocationsOf(order));
      await tx.payment.updateMany({ where: { orderId }, data: { status: "SUCCEEDED" } });
      return true;
    });
    if (done) {
      await this.cache.invalidate(CATALOG_CACHE);
      await this.events.orderPaid(orderId);
    }
    return done;
  }

  /** Annulation d'une commande non payée : le stock réservé est rendu. */
  async cancel(orderId: string): Promise<boolean> {
    const done = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      if (count === 0) return false;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
      await this.stock.release(tx, allocationsOf(order));
      await tx.payment.updateMany({ where: { orderId }, data: { status: "CANCELED" } });
      return true;
    });
    if (done) await this.cache.invalidate(CATALOG_CACHE);
    return done;
  }

  /**
   * Paiements abandonnés depuis plus de 30 min : le paiement Stripe est annulé
   * d'abord, pour qu'il ne puisse plus aboutir. S'il avait en fait réussi,
   * la commande passe à "payée" au lieu d'être annulée.
   */
  async expireAbandoned(limit = 100): Promise<{ cancelled: number; paid: number }> {
    const cutoff = new Date(Date.now() - RESERVATION_MINUTES * 60 * 1000);
    const stale = await this.prisma.order.findMany({
      where: { status: "PENDING", createdAt: { lt: cutoff } },
      include: { payments: true },
      take: limit,
    });
    let cancelled = 0;
    let paid = 0;
    for (const order of stale) {
      const intentId = order.payments[0]?.stripePaymentIntentId;
      try {
        const status = intentId ? await this.stripe.cancel(intentId) : "canceled";
        if (status === "succeeded") {
          if (await this.markPaid(order.id)) paid++;
        } else if (await this.cancel(order.id)) {
          cancelled++;
        }
      } catch (error) {
        this.logger.warn(`Expiration impossible pour la commande ${order.id} : ${String(error)}`);
      }
    }
    return { cancelled, paid };
  }

  /** Suivi d'une commande avec son jeton (client avec ou sans compte). */
  async getWithToken(orderId: string, token: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: true, pickupStore: true, payments: true },
    });
    const expected = Buffer.from(order?.accessTokenHash ?? "0".repeat(64), "hex");
    const given = Buffer.from(sha256(token), "hex");
    if (!order || !timingSafeEqual(expected, given)) throw new NotFoundException("Commande introuvable.");

    // Webhook pas encore reçu (ou injoignable, en Preview) : on demande l'état à Stripe.
    const intentId = order.payments[0]?.stripePaymentIntentId;
    if (order.status === "PENDING" && intentId) {
      const status = await this.stripe.retrieveStatus(intentId).catch(() => null);
      if (status === "succeeded" && (await this.markPaid(order.id))) return this.getDetails(order.id);
    }
    return toOrderDto(order);
  }

  private async getDetails(orderId: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { lines: true, pickupStore: true },
    });
    return toOrderDto(order);
  }

  /** Historique des commandes du client connecté (EF09). */
  async listForUser(userId: string): Promise<OrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { userId, status: { not: "PENDING" } },
      include: { lines: true, pickupStore: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return orders.map(toOrderDto);
  }
}
