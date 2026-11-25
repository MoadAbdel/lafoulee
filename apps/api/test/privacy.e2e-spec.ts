import request from "supertest";
import { generate } from "otplib";
import type { GdprRequestDto } from "@lafoulee/shared";
import { encrypt } from "../src/common/crypto.js";
import { env } from "../src/config/env.js";
import { PasswordService } from "../src/auth/password.service.js";
import { PrivacyService } from "../src/privacy/privacy.service.js";
import { createTestApp, resetRateLimits, uniqueEmail, type TestApp } from "./helpers.js";

const PASSWORD = "Foulee-2026-lyon";
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

/** RGPD (C11, EF10, EF11, EA06) et durées de conservation (C9). */
describe("RGPD et newsletter (e2e)", () => {
  let t: TestApp;
  let admin: string;
  const http = () => request(t.app.getHttpServer());
  const session = (res: request.Response) =>
    (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("lf_at="))!.split(";")[0]!;
  const tokenIn = (text: string | undefined) => /token=([A-Za-z0-9_-]{43})/.exec(text ?? "")?.[1] ?? "";

  async function customer(): Promise<{ email: string; cookie: string; id: string }> {
    const email = uniqueEmail("rgpd");
    const user = await t.prisma.user.create({
      data: {
        email,
        firstName: "Léa",
        emailVerifiedAt: new Date(),
        passwordHash: await new PasswordService().hash(PASSWORD),
      },
    });
    const cookie = session(await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200));
    return { email, cookie, id: user.id };
  }

  async function guestOrder(email: string) {
    const store = await t.prisma.store.findFirstOrThrow();
    const variant = await t.prisma.productVariant.findFirstOrThrow();
    return t.prisma.order.create({
      data: {
        guestEmail: email,
        status: "PAID",
        fulfillment: "DELIVERY",
        shippingAddress: { fullName: "Léa Martin", line1: "12 rue Max Dormoy", postalCode: "69003", city: "Lyon" },
        subtotalCents: 1000,
        totalCents: 1490,
        shippingCents: 490,
        accessTokenHash: "0".repeat(64),
        lines: {
          create: [
            {
              variantId: variant.id,
              storeId: store.id,
              productName: "Test",
              variantLabel: "42",
              unitPriceCents: 1000,
              quantity: 1,
            },
          ],
        },
      },
    });
  }

  beforeAll(async () => {
    t = await createTestApp();
    await resetRateLimits(t.redis);
    const email = uniqueEmail("admin-rgpd");
    await t.prisma.user.create({
      data: {
        email,
        role: "ADMIN",
        emailVerifiedAt: new Date(),
        passwordHash: await new PasswordService().hash(PASSWORD),
        totpSecretEnc: encrypt(SECRET, env().TOTP_ENC_KEY),
      },
    });
    const step1 = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
    admin = session(
      await http()
        .post("/api/v1/auth/login/totp")
        .send({ challenge: step1.body.challenge, code: await generate({ secret: SECRET }) })
        .expect(200),
    );
  });

  beforeEach(async () => {
    await resetRateLimits(t.redis);
    t.mails.length = 0;
  });

  afterAll(async () => {
    await t.prisma.orderLine.deleteMany({ where: { productName: "Test", order: { totalCents: 1490 } } });
    await t.prisma.order.deleteMany({ where: { lines: { none: {} } } });
    await t.prisma.gdprRequest.deleteMany({});
    await t.prisma.auditLog.deleteMany({ where: { action: { startsWith: "gdpr." } } });
    await t.prisma.user.deleteMany({
      where: { OR: [{ email: { endsWith: "@test.lafoulee.example" } }, { email: { endsWith: "@anonyme.invalid" } }] },
    });
    await t.app.close();
  });

  it("C11 preuve du consentement : enregistrée sans donnée identifiante ; format strict", async () => {
    const consentId = crypto.randomUUID();
    await http()
      .post("/api/v1/consents")
      .send({ consentId, version: "2026-11", choices: { contenusTiers: false } })
      .expect(204);
    const log = await t.prisma.consentLog.findFirstOrThrow({ where: { consentId } });
    expect(log.choices).toEqual({ contenusTiers: false });
    await http()
      .post("/api/v1/consents")
      .send({ consentId, version: "x", choices: { pub: true } })
      .expect(400);
  });

  it("TB23/EF11 export JSON du compte connecté, avec ses commandes", async () => {
    const { email, cookie } = await customer();
    await guestOrder(email);
    const res = await http().get("/api/v1/me/data").set("Cookie", cookie).expect(200);
    expect(res.headers["content-disposition"]).toContain("mes-donnees-la-foulee.json");
    expect(res.body.compte.email).toBe(email);
    expect(res.body.commandes).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toMatch(/password|totp/i);
  });

  it("TB24/RG5 suppression : mot de passe exigé, compte anonymisé, commandes gardées sans données identifiantes", async () => {
    const { email, cookie, id } = await customer();
    const order = await guestOrder(email);
    await http().post("/api/v1/me/delete").set("Cookie", cookie).send({ password: "mauvais" }).expect(401);
    const res = await http().post("/api/v1/me/delete").set("Cookie", cookie).send({ password: PASSWORD }).expect(204);
    expect(String(res.headers["set-cookie"])).toMatch(/lf_at=;/);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { id } });
    expect(user.email).toMatch(/@anonyme\.invalid$/);
    expect(user.firstName).toBeNull();
    const kept = await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect([kept.guestEmail, kept.shippingAddress, kept.totalCents]).toEqual([null, { anonymise: true }, 1490]);
    await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(401);
  });

  it("un compte administrateur ne se supprime pas depuis le site", async () => {
    await http().post("/api/v1/me/delete").set("Cookie", admin).send({ password: PASSWORD }).expect(403);
  });

  it("TB25 demande d'un visiteur : lien de confirmation à usage unique, échéance d'un mois", async () => {
    const email = uniqueEmail("visiteur");
    const res = await http().post("/api/v1/privacy/requests").send({ email, type: "ACCESS" }).expect(202);
    expect(res.body).toEqual({ status: "CONFIRMATION_SENT" });
    expect(await t.prisma.gdprRequest.count({ where: { email } })).toBe(0); // rien avant confirmation
    const token = tokenIn(t.mails.at(-1)?.text);
    await http().post("/api/v1/privacy/requests/confirm").send({ token }).expect(200);
    await http().post("/api/v1/privacy/requests/confirm").send({ token }).expect(403);
    const created = await t.prisma.gdprRequest.findFirstOrThrow({ where: { email } });
    const days = (created.dueAt.getTime() - created.createdAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(30);
  });

  it("EA06 traitement admin : export envoyé en pièce jointe (accès), anonymisation (effacement), journalisé", async () => {
    const email = uniqueEmail("demande");
    const order = await guestOrder(email);
    for (const type of ["ACCESS", "DELETION"] as const) {
      await http().post("/api/v1/privacy/requests").send({ email, type }).expect(202);
      await http()
        .post("/api/v1/privacy/requests/confirm")
        .send({ token: tokenIn(t.mails.at(-1)?.text) })
        .expect(200);
    }
    await http().get("/api/v1/admin/gdpr-requests").expect(401);
    const list = (await http().get("/api/v1/admin/gdpr-requests").set("Cookie", admin).expect(200))
      .body as GdprRequestDto[];
    const access = list.find((row) => row.email === email && row.type === "ACCESS")!;
    const deletion = list.find((row) => row.email === email && row.type === "DELETION")!;

    t.mails.length = 0;
    await http().post(`/api/v1/admin/gdpr-requests/${access.id}/process`).set("Cookie", admin).expect(201);
    expect(t.mails[0]?.attachments?.[0]?.name).toBe("mes-donnees-la-foulee.json");
    expect(JSON.parse(t.mails[0]!.attachments![0]!.content).commandes).toHaveLength(1);

    await http().post(`/api/v1/admin/gdpr-requests/${deletion.id}/process`).set("Cookie", admin).expect(201);
    expect((await t.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).guestEmail).toBeNull();
    expect((await t.prisma.gdprRequest.findUniqueOrThrow({ where: { id: deletion.id } })).email).toBe("supprime");
    await http().post(`/api/v1/admin/gdpr-requests/${deletion.id}/process`).set("Cookie", admin).expect(403);
    expect(await t.prisma.auditLog.count({ where: { entityId: { in: [access.id, deletion.id] } } })).toBe(2);
  });

  it("TB22/EF10 newsletter : double opt-in, puis désinscription signée en un clic", async () => {
    const email = uniqueEmail("news");
    await http().post("/api/v1/newsletter").send({ email }).expect(202);
    expect((await t.prisma.newsletterSubscription.findUniqueOrThrow({ where: { email } })).status).toBe("PENDING");
    const token = tokenIn(t.mails.at(-1)?.text);
    await http().post("/api/v1/newsletter/confirm").send({ token }).expect(200);
    await http().post("/api/v1/newsletter/confirm").send({ token }).expect(403); // usage unique
    expect((await t.prisma.newsletterSubscription.findUniqueOrThrow({ where: { email } })).status).toBe("CONFIRMED");

    const signature = t.app.get(PrivacyService).unsubscribeSignature(email);
    await http()
      .post("/api/v1/newsletter/unsubscribe")
      .send({ email, signature: "0".repeat(64) })
      .expect(403);
    await http().post("/api/v1/newsletter/unsubscribe").send({ email, signature }).expect(200);
    expect(await t.prisma.newsletterSubscription.findUnique({ where: { email } })).toBeNull();
  });

  it("C9 durées de conservation appliquées par la tâche de nuit", async () => {
    const old = (days: number) => new Date(Date.now() - days * 86_400_000);
    const pendingEmail = uniqueEmail("news-oubliee");
    await t.prisma.newsletterSubscription.create({ data: { email: pendingEmail, createdAt: old(8) } });
    const consentId = crypto.randomUUID();
    await t.prisma.consentLog.create({ data: { consentId, version: "old", choices: {}, createdAt: old(200) } });
    const inactive = await t.prisma.user.create({
      data: {
        email: uniqueEmail("inactif"),
        passwordHash: "x",
        createdAt: old(4 * 365),
        lastLoginAt: old(3 * 365 + 10),
      },
    });

    await http().get("/api/v1/internal/cron/nightly").set("Authorization", `Bearer ${env().CRON_SECRET}`).expect(200);

    expect(await t.prisma.newsletterSubscription.findUnique({ where: { email: pendingEmail } })).toBeNull();
    expect(await t.prisma.consentLog.count({ where: { consentId } })).toBe(0);
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: inactive.id } })).anonymizedAt).not.toBeNull();
  });

  it("durées de conservation : newsletter non confirmée après 7 jours, confirmée après 3 ans", async () => {
    const day = 86_400_000,
      now = Date.now();
    const mk = (email: string, status: "PENDING" | "CONFIRMED", createdDaysAgo: number, confirmedDaysAgo?: number) =>
      t.prisma.newsletterSubscription.create({
        data: {
          email,
          status,
          createdAt: new Date(now - createdDaysAgo * day),
          confirmedAt: confirmedDaysAgo === undefined ? null : new Date(now - confirmedDaysAgo * day),
        },
      });
    const vieille = uniqueEmail("nl-vieille"),
      recente = uniqueEmail("nl-recente"),
      attente = uniqueEmail("nl-attente");
    await mk(vieille, "CONFIRMED", 1200, 1100);
    await mk(recente, "CONFIRMED", 400, 400);
    await mk(attente, "PENDING", 10);
    const result = await t.app.get(PrivacyService).applyRetention();
    expect(result.newsletterPlusDe3Ans).toBeGreaterThanOrEqual(1);
    const restants = await t.prisma.newsletterSubscription.findMany({
      where: { email: { in: [vieille, recente, attente] } },
    });
    expect(restants.map((r) => r.email)).toEqual([recente]);
  });
});
