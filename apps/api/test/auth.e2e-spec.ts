import request from "supertest";
import { vi } from "vitest";
import { MailService } from "../src/mail/mail.service.js";
import { generate } from "otplib";
import type { LoginResult } from "@lafoulee/shared";
import { encrypt } from "../src/common/crypto.js";
import { env } from "../src/config/env.js";
import { PasswordService } from "../src/auth/password.service.js";
import { createTestApp, resetRateLimits, tokenFromMail, uniqueEmail, type TestApp } from "./helpers.js";

const PASSWORD = "Foulee-2026-lyon";

describe("Authentification (e2e)", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetRateLimits(t.redis);
    t.mails.length = 0;
  });

  afterAll(async () => {
    await t.prisma.user.deleteMany({ where: { email: { endsWith: "@test.lafoulee.example" } } });
    await t.app.close();
  });

  const http = () => request(t.app.getHttpServer());

  /** Inscrit puis vérifie un client ; renvoie son email. */
  async function verifiedCustomer(): Promise<string> {
    const email = uniqueEmail("client");
    await http().post("/api/v1/auth/register").send({ email, password: PASSWORD }).expect(202);
    await http()
      .post("/api/v1/auth/verify-email")
      .send({ token: tokenFromMail(t.mails.at(-1)) })
      .expect(200);
    return email;
  }

  function cookies(res: request.Response): string[] {
    const header = res.headers["set-cookie"] as unknown as string[] | undefined;
    return header ?? [];
  }

  it("TF09 inscription : mot de passe faible refusé avec un message par règle", async () => {
    const res = await http()
      .post("/api/v1/auth/register")
      .send({ email: uniqueEmail("faible"), password: "court" })
      .expect(400);
    expect(res.body.message.join(" ")).toContain("12 caractères minimum");
  });

  it("TB20 champ non prévu (role) refusé en 400", async () => {
    await http()
      .post("/api/v1/auth/register")
      .send({ email: uniqueEmail("role"), password: PASSWORD, role: "ADMIN" })
      .expect(400);
  });

  it("EF08 inscription : même réponse pour un email nouveau ou existant (pas d'énumération)", async () => {
    const email = await verifiedCustomer();
    const again = await http().post("/api/v1/auth/register").send({ email, password: PASSWORD }).expect(202);
    expect(again.body).toEqual({ status: "VERIFICATION_SENT" });
  });

  it("un échec d'envoi de l'email n'empêche pas l'inscription (202)", async () => {
    vi.spyOn(t.app.get(MailService), "send").mockRejectedValueOnce(new Error("Brevo HTTP 401"));
    const email = uniqueEmail("brevo-ko");
    await http().post("/api/v1/auth/register").send({ email, password: PASSWORD }).expect(202);
    expect(await t.prisma.user.findUnique({ where: { email } })).not.toBeNull();
  });

  it("TB14 connexion refusée tant que l'email n'est pas vérifié", async () => {
    const email = uniqueEmail("nonverifie");
    await http().post("/api/v1/auth/register").send({ email, password: PASSWORD }).expect(202);
    const res = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("lien de vérification à usage unique, et lien expiré refusé", async () => {
    const email = uniqueEmail("lien");
    await http().post("/api/v1/auth/register").send({ email, password: PASSWORD }).expect(202);
    const token = tokenFromMail(t.mails.at(-1));
    await http().post("/api/v1/auth/verify-email").send({ token }).expect(200);
    await http().post("/api/v1/auth/verify-email").send({ token }).expect(403);

    const other = uniqueEmail("expire");
    await http().post("/api/v1/auth/register").send({ email: other, password: PASSWORD }).expect(202);
    const expired = tokenFromMail(t.mails.at(-1));
    await t.prisma.emailToken.updateMany({ where: { email: other }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await http().post("/api/v1/auth/verify-email").send({ token: expired }).expect(403);
  });

  it("le jeton du lien n'est jamais stocké en clair", async () => {
    const email = uniqueEmail("hash");
    await http().post("/api/v1/auth/register").send({ email, password: PASSWORD }).expect(202);
    const token = tokenFromMail(t.mails.at(-1));
    const stored = await t.prisma.emailToken.findFirstOrThrow({ where: { email } });
    expect(stored.tokenHash).not.toContain(token);
  });

  it("connexion client : cookies HttpOnly, SameSite=Lax, jeton de rafraîchissement limité à /api/v1/auth", async () => {
    const email = await verifiedCustomer();
    const res = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
    expect((res.body as LoginResult).status).toBe("OK");
    const set = cookies(res);
    const access = set.find((c) => c.startsWith("lf_at="))!;
    const refresh = set.find((c) => c.startsWith("lf_rt="))!;
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/SameSite=Lax/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    const me = await http().get("/api/v1/auth/me").set("Cookie", access.split(";")[0]!).expect(200);
    expect(me.body.email).toBe(email);
    expect(me.body.passwordHash).toBeUndefined();
  });

  it("mauvais mot de passe et email inconnu : même message (401)", async () => {
    const email = await verifiedCustomer();
    const wrong = await http().post("/api/v1/auth/login").send({ email, password: "Mauvais-2026-lyon" }).expect(401);
    const unknown = await http()
      .post("/api/v1/auth/login")
      .send({ email: uniqueEmail("inconnu"), password: PASSWORD })
      .expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it("/auth/me sans session ou avec un jeton falsifié : 401", async () => {
    await http().get("/api/v1/auth/me").expect(401);
    await http().get("/api/v1/auth/me").set("Cookie", "lf_at=eyJhbGciOiJub25lIn0.e30.").expect(401);
  });

  it("TB16 rotation du jeton de rafraîchissement, rejeu détecté et famille révoquée", async () => {
    const email = await verifiedCustomer();
    const login = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
    const first = cookies(login)
      .find((c) => c.startsWith("lf_rt="))!
      .split(";")[0]!;

    const refreshed = await http().post("/api/v1/auth/refresh").set("Cookie", first).expect(200);
    const second = cookies(refreshed)
      .find((c) => c.startsWith("lf_rt="))!
      .split(";")[0]!;
    expect(second).not.toBe(first);

    await http().post("/api/v1/auth/refresh").set("Cookie", first).expect(401); // rejeu
    await http().post("/api/v1/auth/refresh").set("Cookie", second).expect(401); // famille révoquée
  });

  it("déconnexion : le jeton de rafraîchissement ne sert plus", async () => {
    const email = await verifiedCustomer();
    const login = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
    const refresh = cookies(login)
      .find((c) => c.startsWith("lf_rt="))!
      .split(";")[0]!;
    await http().post("/api/v1/auth/logout").set("Cookie", refresh).expect(204);
    await http().post("/api/v1/auth/refresh").set("Cookie", refresh).expect(401);
  });

  it("limitation de débit : 429 au-delà de 10 connexions par minute et par IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await http()
        .post("/api/v1/auth/login")
        .send({ email: uniqueEmail("rl"), password: "x" });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("requête d'écriture depuis un autre site refusée (403)", async () => {
    await http()
      .post("/api/v1/auth/login")
      .set("Origin", "https://evil.example")
      .send({ email: uniqueEmail("csrf"), password: PASSWORD })
      .expect(403);
  });

  describe("administrateur avec double authentification", () => {
    let email: string;
    let secret: string;

    beforeAll(async () => {
      email = uniqueEmail("admin");
      secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
      await t.prisma.user.create({
        data: {
          email,
          role: "ADMIN",
          emailVerifiedAt: new Date(),
          passwordHash: await new PasswordService().hash(PASSWORD),
          totpSecretEnc: encrypt(secret, env().TOTP_ENC_KEY),
        },
      });
    });

    async function challenge(): Promise<string> {
      const res = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
      const body = res.body as LoginResult;
      expect(body.status).toBe("TOTP_REQUIRED");
      expect(cookies(res)).toHaveLength(0); // aucune session avant le code
      return (body as { challenge: string }).challenge;
    }

    it("TB17 code TOTP faux refusé", async () => {
      await http()
        .post("/api/v1/auth/login/totp")
        .send({ challenge: await challenge(), code: "000000" })
        .expect(401);
    });

    it("EA01 bon code : session admin et entrée dans le journal d'audit ; code rejoué refusé", async () => {
      const ch = await challenge();
      const code = await generate({ secret });
      const res = await http().post("/api/v1/auth/login/totp").send({ challenge: ch, code }).expect(200);
      expect(res.body.user.role).toBe("ADMIN");
      const audit = await t.prisma.auditLog.findFirst({ where: { actor: { email }, action: "admin.login" } });
      expect(audit?.ip).toBeTruthy();
      await http().post("/api/v1/auth/login/totp").send({ challenge: ch, code }).expect(401);
    });

    it("défi falsifié refusé", async () => {
      await http().post("/api/v1/auth/login/totp").send({ challenge: "faux.defi.signe", code: "123456" }).expect(401);
    });
  });
});
