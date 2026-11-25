import request from "supertest";
import { generate } from "otplib";
import type {
  AdminListDto,
  AdminOrderDto,
  AdminProductDetailDto,
  ApiKeyDto,
  CreatedApiKeyDto,
  CreateOrderResult,
  DashboardDto,
  ProductListDto,
} from "@lafoulee/shared";
import { encrypt } from "../src/common/crypto.js";
import { env } from "../src/config/env.js";
import { PasswordService } from "../src/auth/password.service.js";
import { OPENAPI_DOCUMENT } from "../src/partner/openapi.js";
import { createTestApp, resetRateLimits, uniqueEmail, type TestApp } from "./helpers.js";

const PASSWORD = "Foulee-2026-lyon";
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

/** Back-office (EA01 à EA08) et API partenaires (EP01, C24). */
describe("Back-office et API partenaires (e2e)", () => {
  let t: TestApp;
  let admin: string; // cookie de session admin
  let customer: string; // cookie de session client
  let productId: string;
  let productSlug: string;
  let variantId: string;
  let store: { id: string; slug: string };

  const http = () => request(t.app.getHttpServer());
  const sessionCookie = (res: request.Response) =>
    (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("lf_at="))!.split(";")[0]!;

  async function stock() {
    return t.prisma.stock.findUniqueOrThrow({ where: { variantId_storeId: { variantId, storeId: store.id } } });
  }

  /** Commande payée en retrait, prête à être traitée par l'admin. */
  async function paidOrder(): Promise<string> {
    const put = await http().put("/api/v1/cart/items").send({ variantId, quantity: 1 }).expect(200);
    const cart = (put.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("lf_cart="))!
      .split(";")[0]!;
    const created = (
      await http()
        .post("/api/v1/orders")
        .set("Cookie", cart)
        .send({ fulfillment: "PICKUP", acceptCgv: true, pickupStoreSlug: store.slug, email: uniqueEmail("achat") })
        .expect(201)
    ).body as CreateOrderResult;
    const payment = await t.prisma.payment.findFirstOrThrow({ where: { orderId: created.orderId } });
    t.stripe.intents.get(payment.stripePaymentIntentId)!.status = "succeeded";
    await http().get(`/api/v1/orders/${created.orderId}?jeton=${created.accessToken}`).expect(200); // passe à PAID
    return created.orderId;
  }

  beforeAll(async () => {
    t = await createTestApp();
    await resetRateLimits(t.redis);
    const passwordHash = await new PasswordService().hash(PASSWORD);
    const adminEmail = uniqueEmail("admin");
    const customerEmail = uniqueEmail("client");
    await t.prisma.user.create({
      data: {
        email: adminEmail,
        role: "ADMIN",
        emailVerifiedAt: new Date(),
        passwordHash,
        totpSecretEnc: encrypt(SECRET, env().TOTP_ENC_KEY),
      },
    });
    await t.prisma.user.create({ data: { email: customerEmail, emailVerifiedAt: new Date(), passwordHash } });

    const step1 = await http().post("/api/v1/auth/login").send({ email: adminEmail, password: PASSWORD }).expect(200);
    const step2 = await http()
      .post("/api/v1/auth/login/totp")
      .send({ challenge: step1.body.challenge, code: await generate({ secret: SECRET }) })
      .expect(200);
    admin = sessionCookie(step2);
    customer = sessionCookie(
      await http().post("/api/v1/auth/login").send({ email: customerEmail, password: PASSWORD }).expect(200),
    );

    store = (await t.prisma.store.findFirstOrThrow({ orderBy: { slug: "asc" }, select: { id: true, slug: true } }))!;
    const product = await t.prisma.product.create({
      data: {
        slug: `test-admin-${Date.now()}`,
        name: "Test Admin",
        brand: "Essai",
        shortDescription: "Produit de test",
        description: "Produit de test pour le back-office.",
        priceCents: 4000,
        status: "PUBLISHED",
        variants: { create: [{ sku: `TEST-ADMIN-${Date.now()}`, size: "42", color: "Vert" }] },
      },
      include: { variants: true },
    });
    productId = product.id;
    productSlug = product.slug;
    variantId = product.variants[0]!.id;
    await t.prisma.stock.create({ data: { variantId, storeId: store.id, quantity: 5, alertThreshold: 2 } });
  });

  beforeEach(async () => {
    await resetRateLimits(t.redis);
    t.mails.length = 0;
  });

  afterAll(async () => {
    await t.prisma.orderLine.deleteMany({ where: { variant: { productId } } });
    await t.prisma.order.deleteMany({ where: { lines: { none: {} } } });
    await t.prisma.product.delete({ where: { id: productId } });
    await t.prisma.apiKey.deleteMany({ where: { creator: { email: { endsWith: "@test.lafoulee.example" } } } });
    await t.prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: "@test.lafoulee.example" } } } });
    await t.prisma.user.deleteMany({ where: { email: { endsWith: "@test.lafoulee.example" } } });
    await t.app.close();
  });

  it("TE05/TB19 sans session : 401 ; client : 403 ; admin : 200", async () => {
    await http().get("/api/v1/admin/dashboard").expect(401);
    await http().get("/api/v1/admin/dashboard").set("Cookie", customer).expect(403);
    await http().get("/api/v1/admin/dashboard").set("Cookie", admin).expect(200);
  });

  it("TB32/EA02 tableau de bord : total des stocks bas et commandes à traiter", async () => {
    const where = { variantId_storeId: { variantId, storeId: store.id } };
    const before = ((await http().get("/api/v1/admin/dashboard").set("Cookie", admin).expect(200)).body as DashboardDto)
      .lowStockCount;
    try {
      await t.prisma.stock.update({ where, data: { quantity: 1 } }); // 1 <= seuil 2 : stock bas
      const orderId = await paidOrder();
      const dashboard = (await http().get("/api/v1/admin/dashboard").set("Cookie", admin).expect(200))
        .body as DashboardDto;
      expect(dashboard.lowStockCount).toBe(before + 1);
      expect(dashboard.lowStock.length).toBeLessThanOrEqual(20);
      expect(dashboard.recentOrders.some((order) => order.id === orderId)).toBe(true);
      expect(dashboard.revenueTodayCents).toBeGreaterThanOrEqual(4000);
    } finally {
      await t.prisma.stock.update({ where, data: { quantity: 5, reserved: 0 } });
    }
  });

  it("EA05 statut : retrait prêt (email au client), puis terminé ; transition invalide refusée ; audit", async () => {
    const orderId = await paidOrder();
    await http()
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set("Cookie", admin)
      .send({ status: "SHIPPED" })
      .expect(409);
    const ready = await http()
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set("Cookie", admin)
      .send({ status: "READY_FOR_PICKUP" })
      .expect(200);
    expect((ready.body as AdminOrderDto).nextStatuses).toEqual(["COMPLETED"]);
    expect(t.mails.some((mail) => mail.subject.includes("prête en boutique"))).toBe(true);
    await http()
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set("Cookie", admin)
      .send({ status: "COMPLETED" })
      .expect(200);
    const audit = await t.prisma.auditLog.findMany({ where: { entityId: orderId, action: "order.status" } });
    expect(audit).toHaveLength(2);
  });

  it("TE04 remboursement : Stripe appelé, commande remboursée, article remis en stock ; une seule fois", async () => {
    const orderId = await paidOrder();
    const before = (await stock()).quantity;
    const res = await http().post(`/api/v1/admin/orders/${orderId}/refund`).set("Cookie", admin).expect(201);
    expect((res.body as AdminOrderDto).status).toBe("REFUNDED");
    expect((await stock()).quantity).toBe(before + 1);
    expect(t.stripe.refunds).toHaveLength(1);
    await http().post(`/api/v1/admin/orders/${orderId}/refund`).set("Cookie", admin).expect(409);
    // Le webhook charge.refunded qui arrive après ne remet pas l'article en stock une deuxième fois.
    const payment = await t.prisma.payment.findFirstOrThrow({ where: { orderId } });
    const payload = JSON.stringify({
      id: `evt_refund_${Date.now()}`,
      object: "event",
      type: "charge.refunded",
      data: {
        object: { id: "ch_test", object: "charge", refunded: true, payment_intent: payment.stripePaymentIntentId },
      },
    });
    const { header } = t.stripe.signedEventFromPayload(payload);
    await http()
      .post("/api/v1/payments/webhook")
      .set("stripe-signature", header)
      .set("content-type", "application/json")
      .send(payload)
      .expect(200);
    expect((await stock()).quantity).toBe(before + 1);
  });

  it("EA03 archivage d'un produit : il disparaît du catalogue public ; corps vide refusé ; audit avant/après", async () => {
    await http().patch(`/api/v1/admin/products/${productId}`).set("Cookie", admin).send({}).expect(400);
    await http()
      .patch(`/api/v1/admin/products/${productId}`)
      .set("Cookie", admin)
      .send({ status: "ARCHIVED" })
      .expect(200);
    await http().get(`/api/v1/products/${productSlug}`).expect(404);
    const audit = await t.prisma.auditLog.findFirstOrThrow({
      where: { entityId: productId, action: "product.update" },
    });
    expect(audit.details).toMatchObject({ status: { from: "PUBLISHED", to: "ARCHIVED" } });
    await http()
      .patch(`/api/v1/admin/products/${productId}`)
      .set("Cookie", admin)
      .send({ status: "PUBLISHED" })
      .expect(200);
    const detail = (await http().get(`/api/v1/admin/products/${productId}`).set("Cookie", admin).expect(200))
      .body as AdminProductDetailDto;
    expect(detail.variants[0]!.stocks[0]).toMatchObject({ storeSlug: store.slug });
  });

  it("TB35/EA04 stock : ajustement journalisé ; impossible de descendre sous le réservé", async () => {
    await t.prisma.stock.update({
      where: { variantId_storeId: { variantId, storeId: store.id } },
      data: { reserved: 2 },
    });
    await http()
      .put("/api/v1/admin/stocks")
      .set("Cookie", admin)
      .send({ variantId, storeSlug: store.slug, quantity: 1 })
      .expect(409);
    await http()
      .put("/api/v1/admin/stocks")
      .set("Cookie", admin)
      .send({ variantId, storeSlug: store.slug, quantity: 8, alertThreshold: 3 })
      .expect(200);
    const updated = await stock();
    expect([updated.quantity, updated.alertThreshold]).toEqual([8, 3]);
    await t.prisma.stock.update({
      where: { variantId_storeId: { variantId, storeId: store.id } },
      data: { reserved: 0, quantity: 5 },
    });
    const audit = (await http().get("/api/v1/admin/audit").set("Cookie", admin).expect(200)).body as AdminListDto<{
      action: string;
    }>;
    expect(audit.items.some((entry) => entry.action === "stock.update")).toBe(true);
  });

  describe("API partenaires (C24)", () => {
    let key: CreatedApiKeyDto;

    beforeAll(async () => {
      key = (
        await http()
          .post("/api/v1/admin/api-keys")
          .set("Cookie", admin)
          .send({ name: "Club de Lyon", scopes: ["catalog:read"] })
          .expect(201)
      ).body as CreatedApiKeyDto;
    });

    it("EA07 la clé n'est affichée qu'à la création et n'est jamais stockée en clair", async () => {
      expect(key.key).toMatch(/^lf_live_[A-Za-z0-9]{8}_[A-Za-z0-9_-]{43}$/);
      const list = (await http().get("/api/v1/admin/api-keys").set("Cookie", admin).expect(200)).body as (ApiKeyDto & {
        key?: string;
      })[];
      expect(list.find((item) => item.id === key.id)?.key).toBeUndefined();
      const stored = await t.prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } });
      expect(stored.keyHash).not.toContain(key.key.split("_").at(-1)!);
    });

    it("TB26/EP01 clé valide : catalogue lisible, sans aucune donnée personnelle", async () => {
      const res = await http().get("/api/v1/partner/products").set("Authorization", `Bearer ${key.key}`).expect(200);
      const body = JSON.stringify(res.body);
      expect((res.body as ProductListDto).items.length).toBeGreaterThan(0);
      expect(body).not.toMatch(/@|email|password/i);
    });

    it("TB27/TB28 sans clé ou clé fausse : 401 ; droit manquant : 403", async () => {
      await http().get("/api/v1/partner/products").expect(401);
      await http()
        .get("/api/v1/partner/products")
        .set("Authorization", `Bearer ${key.key.slice(0, -1)}x`)
        .expect(401);
      await http().get("/api/v1/partner/stores").set("Authorization", `Bearer ${key.key}`).expect(403);
    });

    it("TB33 limite de 60 requêtes par minute et par clé : 429", async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 61; i++) {
        statuses.push((await http().get("/api/v1/partner/products").set("Authorization", `Bearer ${key.key}`)).status);
      }
      expect(statuses.slice(0, 60).every((status) => status === 200)).toBe(true);
      expect(statuses[60]).toBe(429);
    });

    it("clé révoquée : refusée dès la requête suivante", async () => {
      await http().delete(`/api/v1/admin/api-keys/${key.id}`).set("Cookie", admin).expect(200);
      await http().get("/api/v1/partner/products").set("Authorization", `Bearer ${key.key}`).expect(401);
    });

    it("C27 description OpenAPI publique, qui couvre toutes les routes partenaires", async () => {
      const res = await http().get("/api/v1/partner/openapi.json").expect(200);
      expect(res.body.openapi).toBe("3.1.0");
      expect(Object.keys(OPENAPI_DOCUMENT.paths).sort((a, b) => a.localeCompare(b))).toEqual([
        "/products",
        "/products/{slug}",
        "/stores",
      ]);
    });
  });
});
