import request from "supertest";
import type { CartDto, CreateOrderResult, OrderDto } from "@lafoulee/shared";
import { env } from "../src/config/env.js";
import { PasswordService } from "../src/auth/password.service.js";
import { CART_TTL_SECONDS } from "../src/cart/cart.service.js";
import { createTestApp, resetRateLimits, uniqueEmail, type TestApp } from "./helpers.js";
import { redisKey } from "../src/redis/redis-key.js";

const PASSWORD = "Foulee-2026-lyon";

/**
 * Panier, commande, paiement et stock (EF04 à EF07, RG1 à RG3).
 * Un produit de test dédié est créé : les stocks de démonstration ne bougent pas.
 */
describe("Commande et paiement (e2e)", () => {
  let t: TestApp;
  let productId: string;
  let stores: { id: string; slug: string }[];
  let variantA: string; // 3 paires en boutique 0, 1 en boutique 1
  let variantB: string; // 1 seule paire, boutique 0
  let variantEmpty: string; // rupture partout

  const http = () => request(t.app.getHttpServer());

  async function stockOf(variantId: string, storeId: string) {
    return t.prisma.stock.findUniqueOrThrow({ where: { variantId_storeId: { variantId, storeId } } });
  }

  /** Remet les stocks du produit de test à leur état initial. */
  async function resetStock() {
    await t.prisma.orderLine.deleteMany({ where: { variant: { productId } } });
    await t.prisma.order.deleteMany({
      where: { lines: { none: {} }, guestEmail: { endsWith: "@test.lafoulee.example" } },
    });
    const set = (variantId: string, storeId: string, quantity: number) =>
      t.prisma.stock.upsert({
        where: { variantId_storeId: { variantId, storeId } },
        update: { quantity, reserved: 0 },
        create: { variantId, storeId, quantity },
      });
    await set(variantA, stores[0]!.id, 3);
    await set(variantA, stores[1]!.id, 1);
    await set(variantB, stores[0]!.id, 1);
    await set(variantEmpty, stores[0]!.id, 0);
  }

  /** Nouveau panier (cookie) contenant les articles demandés. */
  async function cartWith(items: [string, number][]): Promise<string> {
    let cookie = "";
    for (const [variantId, quantity] of items) {
      const res = await http()
        .put("/api/v1/cart/items")
        .set("Cookie", cookie)
        .send({ variantId, quantity })
        .expect(200);
      const set = (res.headers["set-cookie"] as unknown as string[] | undefined)?.find((c) => c.startsWith("lf_cart="));
      if (set) cookie = set.split(";")[0]!;
    }
    return cookie;
  }

  it("retrait : le panier ne propose que les boutiques qui ont toutes les lignes en stock", async () => {
    await resetStock();
    const slugs = async (cookie: string) =>
      (await http().get("/api/v1/cart").set("Cookie", cookie).expect(200)).body.pickupStoreSlugs as string[];
    // variantA : 3 en boutique 0, 1 en boutique 1 ; variantB : 1 en boutique 0 seulement.
    expect(await slugs(await cartWith([[variantA, 1]]))).toEqual(
      expect.arrayContaining([stores[0]!.slug, stores[1]!.slug]),
    );
    expect(await slugs(await cartWith([[variantA, 2]]))).toEqual([stores[0]!.slug]);
    expect(
      await slugs(
        await cartWith([
          [variantA, 1],
          [variantB, 1],
        ]),
      ),
    ).toEqual([stores[0]!.slug]);
  });

  async function order(cookie: string, body: object) {
    return http().post("/api/v1/orders").set("Cookie", cookie).send(body);
  }

  function sendWebhook(type: string, intentId: string, eventId?: string) {
    const { payload, header } = t.stripe.signedEvent(type, intentId, eventId);
    return http()
      .post("/api/v1/payments/webhook")
      .set("stripe-signature", header)
      .set("content-type", "application/json")
      .send(payload);
  }

  async function intentOf(orderId: string): Promise<string> {
    return (await t.prisma.payment.findFirstOrThrow({ where: { orderId } })).stripePaymentIntentId;
  }

  beforeAll(async () => {
    t = await createTestApp();
    stores = await t.prisma.store.findMany({ orderBy: { slug: "asc" }, select: { id: true, slug: true } });
    const product = await t.prisma.product.create({
      data: {
        slug: `test-commande-${Date.now()}`,
        name: "Test Commande",
        brand: "Essai",
        shortDescription: "Produit de test",
        description: "Produit de test pour les commandes.",
        priceCents: 2500,
        status: "PUBLISHED",
        variants: {
          create: [
            { sku: `TEST-A-${Date.now()}`, size: "42", color: "Bleu", position: 0 },
            { sku: `TEST-B-${Date.now()}`, size: "43", color: "Bleu", position: 1, priceCentsOverride: 3000 },
            { sku: `TEST-C-${Date.now()}`, size: "44", color: "Bleu", position: 2 },
          ],
        },
      },
      include: { variants: { orderBy: { position: "asc" } } },
    });
    productId = product.id;
    [variantA, variantB, variantEmpty] = product.variants.map((variant) => variant.id) as [string, string, string];
  });

  beforeEach(async () => {
    await resetRateLimits(t.redis);
    await resetStock();
    t.mails.length = 0;
  });

  afterAll(async () => {
    await t.prisma.orderLine.deleteMany({ where: { variant: { productId } } });
    await t.prisma.order.deleteMany({ where: { lines: { none: {} } } });
    await t.prisma.product.delete({ where: { id: productId } });
    await t.prisma.user.deleteMany({ where: { email: { endsWith: "@test.lafoulee.example" } } });
    await t.app.close();
  });

  describe("panier (EF04)", () => {
    it("TB37 crée un cookie HttpOnly et conserve le panier 30 jours dans Redis", async () => {
      const res = await http().put("/api/v1/cart/items").send({ variantId: variantA, quantity: 2 }).expect(200);
      const cookie = (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("lf_cart="))!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Path=\/api\/v1/);
      const ttl = await t.redis.ttl(redisKey("cart", cookie.split(";")[0]!.slice("lf_cart=".length)));
      expect(ttl).toBeGreaterThan(CART_TTL_SECONDS - 60);
    });

    it("prix lus en base (prix de variante prioritaire), quantité limitée au stock disponible", async () => {
      const cookie = await cartWith([
        [variantA, 9],
        [variantB, 1],
      ]);
      const cart = (await http().get("/api/v1/cart").set("Cookie", cookie).expect(200)).body as CartDto;
      const a = cart.lines.find((line) => line.variantId === variantA)!;
      const b = cart.lines.find((line) => line.variantId === variantB)!;
      expect(a.quantity).toBe(4); // 3 + 1 disponibles
      expect(b.unitPriceCents).toBe(3000);
      expect(cart.subtotalCents).toBe(4 * 2500 + 3000);
    });

    it("quantité 0 retire l'article ; taille en rupture ou inconnue refusée", async () => {
      const cookie = await cartWith([[variantA, 1]]);
      const empty = await http()
        .put("/api/v1/cart/items")
        .set("Cookie", cookie)
        .send({ variantId: variantA, quantity: 0 });
      expect((empty.body as CartDto).lines).toHaveLength(0);
      await http().put("/api/v1/cart/items").send({ variantId: variantEmpty, quantity: 1 }).expect(400);
      await http().put("/api/v1/cart/items").send({ variantId: crypto.randomUUID(), quantity: 1 }).expect(404);
      await http().put("/api/v1/cart/items").send({ variantId: variantA, quantity: 11 }).expect(400);
    });
  });

  describe("création de commande (EF05, EF06)", () => {
    it("panier vide : 400 ; visiteur sans email : 422 ; boutique inconnue : 400 ; code postal faux : 400", async () => {
      expect(
        (await order("", { fulfillment: "PICKUP", pickupStoreSlug: stores[0]!.slug, email: uniqueEmail("v") })).status,
      ).toBe(400);
      const cookie = await cartWith([[variantA, 1]]);
      expect((await order(cookie, { fulfillment: "PICKUP", pickupStoreSlug: stores[0]!.slug })).status).toBe(422);
      expect(
        (await order(cookie, { fulfillment: "PICKUP", pickupStoreSlug: "inconnue", email: uniqueEmail("v") })).status,
      ).toBe(400);
      const badAddress = { fullName: "Léa Martin", line1: "12 rue Max Dormoy", postalCode: "6900", city: "Lyon" };
      expect(
        (await order(cookie, { fulfillment: "DELIVERY", address: badAddress, email: uniqueEmail("v") })).status,
      ).toBe(400);
    });

    it("TB06 retrait : montant calculé côté serveur, sans frais de port, stock réservé dans la boutique", async () => {
      const cookie = await cartWith([[variantA, 2]]);
      const res = await order(cookie, {
        fulfillment: "PICKUP",
        pickupStoreSlug: stores[0]!.slug,
        email: uniqueEmail("retrait"),
      });
      expect(res.status).toBe(201);
      const result = res.body as CreateOrderResult;
      expect(result.totalCents).toBe(5000);
      expect(result.clientSecret).toContain("_secret_");
      expect(t.stripe.intents.get(await intentOf(result.orderId))?.amount).toBe(5000);
      expect((await stockOf(variantA, stores[0]!.id)).reserved).toBe(2);
    });

    it("livraison sous 60 € : 4,90 € de port ; stock pris dans plusieurs boutiques si besoin", async () => {
      const cookie = await cartWith([[variantA, 2]]);
      const address = { fullName: "Léa Martin", line1: "12 rue Max Dormoy", postalCode: "69003", city: "Lyon" };
      const res = await order(cookie, { fulfillment: "DELIVERY", address, email: uniqueEmail("livraison") });
      expect((res.body as CreateOrderResult).totalCents).toBe(5490);

      // Il reste 1 paire en boutique 0 et 1 en boutique 1 : la livraison prend dans les deux.
      const split = await cartWith([[variantA, 2]]);
      const res2 = await order(split, { fulfillment: "DELIVERY", address, email: uniqueEmail("livraison") });
      expect(res2.status).toBe(201);
      expect((await stockOf(variantA, stores[0]!.id)).reserved).toBe(3);
      expect((await stockOf(variantA, stores[1]!.id)).reserved).toBe(1);
      const lines = await t.prisma.orderLine.findMany({ where: { orderId: (res2.body as CreateOrderResult).orderId } });
      expect(lines.map((line) => line.quantity).sort((a, b) => a - b)).toEqual([1, 1]);
    });

    it("TB04/RG1 deux commandes simultanées sur la dernière paire : une seule réussit", async () => {
      const [c1, c2] = [await cartWith([[variantB, 1]]), await cartWith([[variantB, 1]])];
      const body = { fulfillment: "PICKUP", pickupStoreSlug: stores[0]!.slug, email: uniqueEmail("course") };
      const statuses = (await Promise.all([order(c1, body), order(c2, body)]))
        .map((res) => res.status)
        .sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);
      const stock = await stockOf(variantB, stores[0]!.id);
      expect(stock.reserved).toBe(1);
      expect(stock.reserved).toBeLessThanOrEqual(stock.quantity);
    });

    it("retrait dans une boutique sans stock : 409 avec le produit en cause", async () => {
      const cookie = await cartWith([[variantB, 1]]);
      const res = await order(cookie, {
        fulfillment: "PICKUP",
        pickupStoreSlug: stores[1]!.slug,
        email: uniqueEmail("vide"),
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("OUT_OF_STOCK");
      expect(res.body.message).toContain("43");
    });

    it("Stripe indisponible : 502 et stock rendu", async () => {
      const cookie = await cartWith([[variantA, 1]]);
      t.stripe.failNextCreate = true;
      const res = await order(cookie, {
        fulfillment: "PICKUP",
        pickupStoreSlug: stores[0]!.slug,
        email: uniqueEmail("ko"),
      });
      expect(res.status).toBe(502);
      expect((await stockOf(variantA, stores[0]!.id)).reserved).toBe(0);
    });
  });

  describe("paiement et webhook (C23, RG3)", () => {
    async function pendingOrder(quantity = 1) {
      const cookie = await cartWith([[variantA, quantity]]);
      const res = await order(cookie, {
        fulfillment: "PICKUP",
        pickupStoreSlug: stores[0]!.slug,
        email: uniqueEmail("paiement"),
      });
      const result = res.body as CreateOrderResult;
      return { ...result, intentId: await intentOf(result.orderId) };
    }

    it("TB08 webhook signé : commande payée, stock décompté, email de confirmation envoyé", async () => {
      const { orderId, intentId } = await pendingOrder(2);
      t.stripe.intents.get(intentId)!.status = "succeeded";
      expect((await sendWebhook("payment_intent.succeeded", intentId)).status).toBe(200);
      const saved = await t.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(saved.status).toBe("PAID");
      const stock = await stockOf(variantA, stores[0]!.id);
      expect([stock.quantity, stock.reserved]).toEqual([1, 0]);
      expect(t.mails.filter((mail) => mail.subject.includes(`n°${saved.number}`))).toHaveLength(1);
    });

    it("TB10 événement rejoué ou doublon : traité une seule fois (stock et email)", async () => {
      const { intentId } = await pendingOrder(1);
      t.stripe.intents.get(intentId)!.status = "succeeded";
      await sendWebhook("payment_intent.succeeded", intentId, "evt_meme_id").expect(200);
      const replay = await sendWebhook("payment_intent.succeeded", intentId, "evt_meme_id").expect(200);
      expect(replay.body.duplicate).toBe(true);
      await sendWebhook("payment_intent.succeeded", intentId).expect(200); // autre id, même paiement
      expect((await stockOf(variantA, stores[0]!.id)).quantity).toBe(2);
      expect(t.mails).toHaveLength(1);
    });

    it("TB09 signature absente ou invalide : 400, aucune modification", async () => {
      const { orderId, intentId } = await pendingOrder();
      const { payload } = t.stripe.signedEvent("payment_intent.succeeded", intentId);
      await http().post("/api/v1/payments/webhook").set("content-type", "application/json").send(payload).expect(400);
      await http()
        .post("/api/v1/payments/webhook")
        .set("stripe-signature", "t=1,v1=faux")
        .set("content-type", "application/json")
        .send(payload)
        .expect(400);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");
    });

    it("TB11 paiement refusé : la commande reste en attente (nouvel essai possible) ; annulé : stock rendu", async () => {
      const { orderId, intentId } = await pendingOrder();
      await sendWebhook("payment_intent.payment_failed", intentId).expect(200);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PENDING");
      await sendWebhook("payment_intent.canceled", intentId).expect(200);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CANCELLED");
      expect((await stockOf(variantA, stores[0]!.id)).reserved).toBe(0);
    });

    it("suivi avec le jeton : sans webhook, la page de confirmation obtient l'état auprès de Stripe", async () => {
      const { orderId, accessToken, intentId } = await pendingOrder();
      await http()
        .get(`/api/v1/orders/${orderId}?jeton=${"x".repeat(43)}`)
        .expect(404);
      const pending = (await http().get(`/api/v1/orders/${orderId}?jeton=${accessToken}`).expect(200)).body as OrderDto;
      expect(pending.status).toBe("PENDING");
      t.stripe.intents.get(intentId)!.status = "succeeded";
      const paid = (await http().get(`/api/v1/orders/${orderId}?jeton=${accessToken}`).expect(200)).body as OrderDto;
      expect(paid.status).toBe("PAID");
      expect(paid.lines[0]).toMatchObject({ productName: "Essai Test Commande", variantLabel: "42, Bleu" });
    });

    it("TB12 tâche de nuit : paiement abandonné depuis plus de 30 min annulé, stock rendu ; secret exigé", async () => {
      const { orderId, intentId } = await pendingOrder();
      await t.prisma.order.update({
        where: { id: orderId },
        data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
      });
      await http().get("/api/v1/internal/cron/nightly").expect(401);
      await http().get("/api/v1/internal/cron/nightly").set("Authorization", "Bearer mauvais").expect(401);
      await http().get("/api/v1/internal/cron/nightly").set("Authorization", `Bearer ${env().CRON_SECRET}`).expect(200);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("CANCELLED");
      expect(t.stripe.intents.get(intentId)?.status).toBe("canceled");
      expect((await stockOf(variantA, stores[0]!.id)).reserved).toBe(0);
    });

    it("paiement abandonné mais réussi entre-temps : passé à payé, pas annulé", async () => {
      const { orderId, intentId } = await pendingOrder();
      await t.prisma.order.update({
        where: { id: orderId },
        data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
      });
      t.stripe.intents.get(intentId)!.status = "succeeded";
      await http().get("/api/v1/internal/cron/nightly").set("Authorization", `Bearer ${env().CRON_SECRET}`).expect(200);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe("PAID");
    });
  });

  describe("historique client (EF09)", () => {
    it("TB34 un client connecté voit ses commandes payées, pas celles des autres", async () => {
      const email = uniqueEmail("historique");
      await t.prisma.user.create({
        data: { email, emailVerifiedAt: new Date(), passwordHash: await new PasswordService().hash(PASSWORD) },
      });
      const login = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
      const session = (login.headers["set-cookie"] as unknown as string[])
        .find((c) => c.startsWith("lf_at="))!
        .split(";")[0]!;

      const cart = await cartWith([[variantA, 1]]);
      const mine = (await order(`${cart}; ${session}`, { fulfillment: "PICKUP", pickupStoreSlug: stores[0]!.slug }))
        .body as CreateOrderResult;
      const other = await cartWith([[variantA, 1]]);
      await order(other, { fulfillment: "PICKUP", pickupStoreSlug: stores[0]!.slug, email: uniqueEmail("autre") });

      expect((await http().get("/api/v1/me/orders").set("Cookie", session).expect(200)).body).toHaveLength(0); // en attente : masquée
      t.stripe.intents.get(await intentOf(mine.orderId))!.status = "succeeded";
      await sendWebhook("payment_intent.succeeded", await intentOf(mine.orderId)).expect(200);
      const list = (await http().get("/api/v1/me/orders").set("Cookie", session).expect(200)).body as OrderDto[];
      expect(list.map((item) => item.id)).toEqual([mine.orderId]);
      await http().get("/api/v1/me/orders").expect(401);
    });
  });
});
