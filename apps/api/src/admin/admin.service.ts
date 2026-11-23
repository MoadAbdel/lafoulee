import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ADMIN_PAGE_SIZE,
  allowedTransitions,
  REFUNDABLE_STATUSES,
  type AdminListDto,
  type AdminOrderDto,
  type AdminOrderQuery,
  type AdminProductDetailDto,
  type AdminProductQuery,
  type AdminProductRowDto,
  type AuditEntryDto,
  type DashboardDto,
  type LowStockDto,
  type OrderStatus,
  type ProductUpdateInput,
  type StockUpdateInput,
} from "@lafoulee/shared";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import { CatalogInvalidationService } from "../catalog/catalog-invalidation.service.js";
import { MailService } from "../mail/mail.service.js";
import { OrdersService, toOrderDto } from "../orders/orders.service.js";
import { StripeGateway } from "../payments/stripe.gateway.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";

const SOLD: OrderStatus[] = ["PAID", "READY_FOR_PICKUP", "SHIPPED", "COMPLETED"];
const orderInclude = { lines: true, pickupStore: true, user: { select: { email: true } } } as const;
type AdminOrder = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function toAdminOrder(order: AdminOrder): AdminOrderDto {
  return {
    ...toOrderDto(order),
    customerEmail: order.user?.email ?? order.guestEmail,
    shippingAddress: (order.shippingAddress as Record<string, string> | null) ?? null,
    nextStatuses: allowedTransitions(order.status, order.fulfillment),
    refundable: REFUNDABLE_STATUSES.includes(order.status),
  };
}

function pages(total: number) {
  return Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stripe: StripeGateway,
    private readonly catalog: CatalogInvalidationService,
    private readonly mail: MailService,
    private readonly orders: OrdersService,
  ) {}

  /** Tableau de bord (EA02) : chiffres du jour et du mois, travail en attente, stocks bas. */
  async dashboard(): Promise<DashboardDto> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const revenue = (from: Date) =>
      this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: { status: { in: SOLD }, createdAt: { gte: from } },
      });

    const [today, month, ordersToProcess, pendingPayments, lowStockCount, lowStockRows, recent] = await Promise.all([
      revenue(startOfDay),
      revenue(startOfMonth),
      this.prisma.order.count({ where: { status: { in: ["PAID", "READY_FOR_PICKUP", "SHIPPED"] } } }),
      this.prisma.order.count({ where: { status: "PENDING" } }),
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) AS count FROM stocks s
        JOIN product_variants v ON v.id = s.variant_id
        JOIN products p ON p.id = v.product_id
        WHERE p.status = 'PUBLISHED' AND s.quantity - s.reserved <= s.alert_threshold`.then((rows) =>
        Number(rows[0]?.count ?? 0),
      ),
      this.prisma.$queryRaw<
        {
          slug: string;
          name: string;
          size: string;
          color: string;
          store: string;
          available: number;
          threshold: number;
        }[]
      >`
        SELECT p.slug, p.name, v.size, v.color, st.name AS store,
               (s.quantity - s.reserved)::int AS available, s.alert_threshold AS threshold
        FROM stocks s
        JOIN product_variants v ON v.id = s.variant_id
        JOIN products p ON p.id = v.product_id
        JOIN stores st ON st.id = s.store_id
        WHERE p.status = 'PUBLISHED' AND s.quantity - s.reserved <= s.alert_threshold
        ORDER BY (s.quantity - s.reserved) ASC, p.name ASC
        LIMIT 20`,
      this.prisma.order.findMany({
        where: { status: { in: ["PAID", "READY_FOR_PICKUP", "SHIPPED"] } },
        include: orderInclude,
        orderBy: { createdAt: "asc" },
        take: 10,
      }),
    ]);

    const lowStock: LowStockDto[] = lowStockRows.map((row) => ({
      productSlug: row.slug,
      productName: row.name,
      variantLabel: `${row.size}, ${row.color}`,
      storeName: row.store,
      available: row.available,
      alertThreshold: row.threshold,
    }));
    return {
      revenueTodayCents: today._sum.totalCents ?? 0,
      revenueMonthCents: month._sum.totalCents ?? 0,
      ordersToProcess,
      pendingPayments,
      lowStockCount,
      lowStock,
      recentOrders: recent.map(toAdminOrder),
    };
  }

  async listOrders(query: AdminOrderQuery): Promise<AdminListDto<AdminOrderDto>> {
    const where = query.statut ? { status: query.statut } : {};
    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
      }),
    ]);
    return { items: orders.map(toAdminOrder), page: query.page, total, totalPages: pages(total) };
  }

  /** Changement de statut (EA05), selon les transitions autorisées. Le client est prévenu quand le retrait est prêt. */
  async updateOrderStatus(context: AuditContext, orderId: string, status: OrderStatus): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
    if (!order) throw new NotFoundException("Commande introuvable.");
    if (!allowedTransitions(order.status, order.fulfillment).includes(status)) {
      throw new ConflictException(`Passage de "${order.status}" à "${status}" impossible.`);
    }
    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status },
    });
    if (count === 0) throw new ConflictException("La commande a changé entre-temps. Rechargez la page.");
    await this.audit.record(context, "order.status", "order", orderId, { from: order.status, to: status });

    const email = order.user?.email ?? order.guestEmail;
    if (status === "READY_FOR_PICKUP" && email && order.pickupStore) {
      await this.mail
        .send({
          to: email,
          subject: `Commande n°${order.number} prête en boutique`,
          text: `Bonjour,\n\nVotre commande n°${order.number} vous attend à ${order.pickupStore.name}, ${order.pickupStore.address} (${order.pickupStore.openingHours}).\n\nLa Foulée`,
          html: `<p>Bonjour,</p><p>Votre commande n°${order.number} vous attend à ${order.pickupStore.name}, ${order.pickupStore.address} (${order.pickupStore.openingHours}).</p><p>La Foulée</p>`,
        })
        .catch((error: unknown) => this.logger.error(`Email "commande prête" non envoyé : ${String(error)}`));
    }
    return toAdminOrder(await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  }

  /**
   * Remboursement intégral (EA05) : Stripe d'abord, puis la commande passe à
   * "remboursée" et les articles reviennent en stock dans leur boutique.
   */
  async refundOrder(context: AuditContext, orderId: string): Promise<AdminOrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { ...orderInclude, payments: true },
    });
    if (!order) throw new NotFoundException("Commande introuvable.");
    if (!REFUNDABLE_STATUSES.includes(order.status))
      throw new ConflictException("Cette commande ne peut pas être remboursée.");
    const intentId = order.payments.find((payment) => payment.status === "SUCCEEDED")?.stripePaymentIntentId;
    if (!intentId) throw new BadRequestException("Aucun paiement réussi pour cette commande.");

    await this.stripe.refund(intentId);
    // Le webhook charge.refunded a peut-être déjà fait la transition : c'est sans effet dans ce cas.
    await this.orders.markRefunded(orderId);
    await this.audit.record(context, "order.refund", "order", orderId, { amountCents: order.totalCents });
    await this.catalog.catalogChanged();
    return toAdminOrder(await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude }));
  }

  async listProducts(query: AdminProductQuery): Promise<AdminListDto<AdminProductRowDto>> {
    const where: Prisma.ProductWhereInput = query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { brand: { contains: query.q, mode: "insensitive" } },
            { slug: { contains: query.q.toLowerCase() } },
          ],
        }
      : {};
    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: { variants: { select: { stocks: { select: { quantity: true, reserved: true } } } } },
        orderBy: { name: "asc" },
        skip: (query.page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
      }),
    ]);
    const items = products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      priceCents: product.priceCents,
      status: product.status,
      variantCount: product.variants.length,
      totalAvailable: product.variants
        .flatMap((variant) => variant.stocks)
        .reduce((sum, stock) => sum + Math.max(0, stock.quantity - stock.reserved), 0),
    }));
    return { items, page: query.page, total, totalPages: pages(total) };
  }

  async getProduct(id: string): Promise<AdminProductDetailDto> {
    const [product, stores] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id },
        include: { variants: { orderBy: { position: "asc" }, include: { stocks: { include: { store: true } } } } },
      }),
      this.prisma.store.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    ]);
    if (!product) throw new NotFoundException("Produit introuvable.");
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      shortDescription: product.shortDescription,
      description: product.description,
      priceCents: product.priceCents,
      status: product.status,
      stores,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        size: variant.size,
        color: variant.color,
        stocks: variant.stocks.map((stock) => ({
          storeSlug: stock.store.slug,
          quantity: stock.quantity,
          reserved: stock.reserved,
          alertThreshold: stock.alertThreshold,
        })),
      })),
    };
  }

  /** Modification d'un produit (EA03) : publication, archivage, prix, textes. */
  async updateProduct(context: AuditContext, id: string, input: ProductUpdateInput): Promise<AdminProductDetailDto> {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Produit introuvable.");
    await this.prisma.product.update({ where: { id }, data: input });
    const changes = Object.fromEntries(
      Object.keys(input).map((key) => [
        key,
        { from: before[key as keyof typeof before], to: input[key as keyof ProductUpdateInput] },
      ]),
    ) as Prisma.InputJsonValue;
    await this.audit.record(context, "product.update", "product", id, changes);
    await this.catalog.catalogChanged();
    return this.getProduct(id);
  }

  /**
   * Ajustement du stock d'une variante dans une boutique (EA04). Le stock
   * physique ne peut pas descendre sous ce qui est déjà réservé par des paiements en cours.
   */
  async updateStock(context: AuditContext, input: StockUpdateInput): Promise<void> {
    const store = await this.prisma.store.findUnique({ where: { slug: input.storeSlug } });
    if (!store) throw new BadRequestException("Boutique inconnue.");
    const variant = await this.prisma.productVariant.findUnique({ where: { id: input.variantId } });
    if (!variant) throw new NotFoundException("Variante introuvable.");
    const current = await this.prisma.stock.findUnique({
      where: { variantId_storeId: { variantId: input.variantId, storeId: store.id } },
    });
    if (current && input.quantity < current.reserved) {
      throw new ConflictException(
        `${current.reserved} article(s) sont réservés par des paiements en cours : stock minimum ${current.reserved}.`,
      );
    }
    await this.prisma.stock.upsert({
      where: { variantId_storeId: { variantId: input.variantId, storeId: store.id } },
      update: {
        quantity: input.quantity,
        ...(input.alertThreshold === undefined ? {} : { alertThreshold: input.alertThreshold }),
      },
      create: {
        variantId: input.variantId,
        storeId: store.id,
        quantity: input.quantity,
        alertThreshold: input.alertThreshold ?? 2,
      },
    });
    await this.audit.record(context, "stock.update", "variant", input.variantId, {
      store: input.storeSlug,
      from: current?.quantity ?? 0,
      to: input.quantity,
      alertThreshold: input.alertThreshold ?? null,
    });
    await this.catalog.catalogChanged();
  }

  /** Journal d'audit (EA08), du plus récent au plus ancien. */
  async listAudit(page: number): Promise<AdminListDto<AuditEntryDto>> {
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        include: { actor: { select: { email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * ADMIN_PAGE_SIZE,
        take: ADMIN_PAGE_SIZE,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        actorEmail: row.actor?.email ?? null,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        ip: row.ip,
      })),
      page,
      total,
      totalPages: pages(total),
    };
  }
}
