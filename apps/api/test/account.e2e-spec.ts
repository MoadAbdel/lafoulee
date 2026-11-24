import request from "supertest";
import { generate } from "otplib";
import type { AccountProfileDto, LoginResult, TwoFactorSetupDto } from "@lafoulee/shared";
import { createTestApp, resetRateLimits, tokenFromMail, uniqueEmail, type TestApp } from "./helpers.js";

const PASSWORD = "Foulee-2026-lyon";
const NEW_PASSWORD = "Nouveau-mot-2026";

/** Sécurité du compte (EF09) : profil, mot de passe, email, mot de passe oublié, 2FA. */
describe("Sécurité du compte (e2e)", () => {
  let t: TestApp;
  const http = () => request(t.app.getHttpServer());
  const cookies = (res: request.Response) => (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
  const session = (res: request.Response) =>
    cookies(res)
      .filter((c) => c.startsWith("lf_at=") || c.startsWith("lf_rt="))
      .map((c) => c.split(";")[0])
      .join("; ");

  async function customer(): Promise<{ email: string; cookie: string }> {
    const email = uniqueEmail("compte");
    await http().post("/api/v1/auth/register").send({ email, password: PASSWORD }).expect(202);
    await http()
      .post("/api/v1/auth/verify-email")
      .send({ token: tokenFromMail(t.mails.at(-1)) })
      .expect(200);
    const res = await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200);
    return { email, cookie: session(res) };
  }

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetRateLimits(t.redis);
    t.mails.length = 0;
  });
  afterAll(() => t.app.close());

  it("profil : lecture et prénom modifié", async () => {
    const { email, cookie } = await customer();
    const profile = (await http().get("/api/v1/me/profile").set("Cookie", cookie).expect(200))
      .body as AccountProfileDto;
    expect(profile).toMatchObject({ email, twoFactorEnabled: false, role: "CUSTOMER" });
    const updated = (
      await http().patch("/api/v1/me/profile").set("Cookie", cookie).send({ firstName: "Léa" }).expect(200)
    ).body as AccountProfileDto;
    expect(updated.firstName).toBe("Léa");
    await http().get("/api/v1/me/profile").expect(401);
  });

  it("mot de passe : l'actuel est exigé ; les autres sessions sont fermées, celle-ci continue", async () => {
    const { email, cookie } = await customer();
    const other = session(await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200));
    await http()
      .post("/api/v1/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: "Mauvais-2026-lyon", newPassword: NEW_PASSWORD })
      .expect(403);
    const changed = await http()
      .post("/api/v1/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(204);
    // L'autre appareil ne peut plus renouveler sa session ; celui-ci a une session neuve.
    await http().post("/api/v1/auth/refresh").set("Cookie", other).expect(401);
    await http().get("/api/v1/me/profile").set("Cookie", session(changed)).expect(200);
    await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(401);
    await http().post("/api/v1/auth/login").send({ email, password: NEW_PASSWORD }).expect(200);
    expect(t.mails.some((m) => m.to === email && m.subject.includes("mot de passe a été modifié"))).toBe(true);
  });

  it("mot de passe oublié : même réponse pour un email inconnu ; lien à usage unique ; sessions fermées", async () => {
    const { email, cookie } = await customer();
    t.mails.length = 0;
    const unknown = await http()
      .post("/api/v1/auth/password/forgot")
      .send({ email: uniqueEmail("inconnu") })
      .expect(202);
    expect(t.mails).toHaveLength(0);
    const known = await http().post("/api/v1/auth/password/forgot").send({ email }).expect(202);
    expect(known.body).toEqual(unknown.body);
    const token = tokenFromMail(t.mails.at(-1));

    await http().post("/api/v1/auth/password/reset").send({ token, newPassword: "faible" }).expect(400);
    await http().post("/api/v1/auth/password/reset").send({ token, newPassword: NEW_PASSWORD }).expect(204);
    await http().post("/api/v1/auth/password/reset").send({ token, newPassword: NEW_PASSWORD }).expect(403);
    const refreshOnly = cookie.split("; ").find((c) => c.startsWith("lf_rt="))!;
    await http().post("/api/v1/auth/refresh").set("Cookie", refreshOnly).expect(401);
    await http().post("/api/v1/auth/login").send({ email, password: NEW_PASSWORD }).expect(200);
  });

  it("email : rien ne change avant la confirmation ; l'ancienne adresse est prévenue ; lien à usage unique", async () => {
    const { email, cookie } = await customer();
    const newEmail = uniqueEmail("nouveau");
    await http()
      .post("/api/v1/me/email")
      .set("Cookie", cookie)
      .send({ newEmail, currentPassword: "Mauvais-2026-lyon" })
      .expect(403);
    await http()
      .post("/api/v1/me/email")
      .set("Cookie", cookie)
      .send({ newEmail, currentPassword: PASSWORD })
      .expect(202);
    expect(t.mails.some((m) => m.to === email && m.subject.includes("changement d'adresse"))).toBe(true);
    const confirmation = t.mails.find((m) => m.to === newEmail)!;
    const before = (await http().get("/api/v1/me/profile").set("Cookie", cookie).expect(200)).body as AccountProfileDto;
    expect(before.email).toBe(email);

    const token = tokenFromMail(confirmation);
    await http().post("/api/v1/auth/email-change/confirm").send({ token }).expect(200);
    await http().post("/api/v1/auth/email-change/confirm").send({ token }).expect(403);
    await http().post("/api/v1/auth/login").send({ email: newEmail, password: PASSWORD }).expect(200);
    await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(401);
  });

  it("email déjà pris : réponse identique, aucun lien de changement, la nouvelle adresse est seulement prévenue", async () => {
    const first = await customer();
    const second = await customer();
    t.mails.length = 0;
    const res = await http()
      .post("/api/v1/me/email")
      .set("Cookie", second.cookie)
      .send({ newEmail: first.email, currentPassword: PASSWORD })
      .expect(202);
    expect(res.body).toEqual({ status: "CONFIRMATION_SENT" });
    expect(t.mails).toHaveLength(1);
    expect(t.mails[0]!.text).not.toMatch(/token=/);
  });

  it("2FA client : activation par QR et code ; connexion en deux étapes ; désactivation avec mot de passe et code", async () => {
    const { email, cookie } = await customer();
    await http().post("/api/v1/me/2fa/setup").set("Cookie", cookie).send({ currentPassword: "x" }).expect(403);
    const setup = (
      await http().post("/api/v1/me/2fa/setup").set("Cookie", cookie).send({ currentPassword: PASSWORD }).expect(201)
    ).body as TwoFactorSetupDto;
    expect(setup.qrSvg).toMatch(/^<svg/);
    await http().post("/api/v1/me/2fa/enable").set("Cookie", cookie).send({ code: "000000" }).expect(400);
    const enabled = (
      await http()
        .post("/api/v1/me/2fa/enable")
        .set("Cookie", cookie)
        .send({ code: await generate({ secret: setup.secret }) })
        .expect(201)
    ).body as AccountProfileDto;
    expect(enabled.twoFactorEnabled).toBe(true);

    await resetRateLimits(t.redis);
    const step1 = (await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200))
      .body as LoginResult;
    expect(step1.status).toBe("TOTP_REQUIRED");
    // Le même code ne sert qu'une fois (anti-rejeu) : on attend le code suivant si besoin.
    const code = await generate({ secret: setup.secret, epoch: Math.floor(Date.now() / 1000) + 30 });
    const step2 = await http()
      .post("/api/v1/auth/login/totp")
      .send({ challenge: step1.status === "TOTP_REQUIRED" ? step1.challenge : "", code })
      .expect(200);
    const admin = await t.prisma.auditLog.count({ where: { action: "admin.login", entityId: enabled.email } });
    expect(admin).toBe(0); // une connexion client n'est pas journalisée comme une connexion admin

    const next = await generate({ secret: setup.secret, epoch: Math.floor(Date.now() / 1000) - 30 });
    const disabled = (
      await http()
        .post("/api/v1/me/2fa/disable")
        .set("Cookie", session(step2))
        .send({ currentPassword: PASSWORD, code: next })
        .expect(201)
    ).body as AccountProfileDto;
    expect(disabled.twoFactorEnabled).toBe(false);
    const plain = (await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200))
      .body as LoginResult;
    expect(plain.status).toBe("OK");
  });

  it("revue : un changement de mot de passe annule un changement d'email en attente (compte détourné)", async () => {
    const { cookie } = await customer();
    const attacker = uniqueEmail("pirate");
    await http()
      .post("/api/v1/me/email")
      .set("Cookie", cookie)
      .send({ newEmail: attacker, currentPassword: PASSWORD })
      .expect(202);
    const token = tokenFromMail(t.mails.find((m) => m.to === attacker));
    const changed = await http()
      .post("/api/v1/me/password")
      .set("Cookie", cookie)
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      .expect(204);
    expect(changed.status).toBe(204);
    await http().post("/api/v1/auth/email-change/confirm").send({ token }).expect(403);
  });

  it("revue : après un changement d'email, un lien de réinitialisation envoyé à l'ancienne adresse ne sert plus", async () => {
    const { email, cookie } = await customer();
    await http().post("/api/v1/auth/password/forgot").send({ email }).expect(202);
    const resetToken = tokenFromMail(t.mails.findLast((m) => m.to === email));
    const newEmail = uniqueEmail("nouvelle");
    await http()
      .post("/api/v1/me/email")
      .set("Cookie", cookie)
      .send({ newEmail, currentPassword: PASSWORD })
      .expect(202);
    await http()
      .post("/api/v1/auth/email-change/confirm")
      .send({ token: tokenFromMail(t.mails.find((m) => m.to === newEmail)) })
      .expect(200);
    await http().post("/api/v1/auth/password/reset").send({ token: resetToken, newPassword: NEW_PASSWORD }).expect(403);
    const refreshOnly = cookie.split("; ").find((c) => c.startsWith("lf_rt="))!;
    await http().post("/api/v1/auth/refresh").set("Cookie", refreshOnly).expect(401); // sessions fermées
  });

  it("revue : adresse prise entre la demande et la confirmation : 403 clair, pas d'erreur 500", async () => {
    const { cookie } = await customer();
    const newEmail = uniqueEmail("prise");
    await http()
      .post("/api/v1/me/email")
      .set("Cookie", cookie)
      .send({ newEmail, currentPassword: PASSWORD })
      .expect(202);
    const token = tokenFromMail(t.mails.find((m) => m.to === newEmail));
    await t.prisma.user.create({ data: { email: newEmail, passwordHash: "x", emailVerifiedAt: new Date() } });
    const res = await http().post("/api/v1/auth/email-change/confirm").send({ token }).expect(403);
    expect(res.body.message).toContain("déjà utilisée");
  });

  it("revue : codes de double authentification limités par compte, même depuis plusieurs adresses IP", async () => {
    const { email, cookie } = await customer();
    const setup = (
      await http().post("/api/v1/me/2fa/setup").set("Cookie", cookie).send({ currentPassword: PASSWORD }).expect(201)
    ).body as TwoFactorSetupDto;
    const code = await generate({ secret: setup.secret });
    await http().post("/api/v1/me/2fa/enable").set("Cookie", cookie).send({ code }).expect(201);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const step1 = (await http().post("/api/v1/auth/login").send({ email, password: PASSWORD }).expect(200))
        .body as LoginResult;
      const challenge = step1.status === "TOTP_REQUIRED" ? step1.challenge : "";
      const res = await http()
        .post("/api/v1/auth/login/totp")
        .set("X-Forwarded-For", `203.0.113.${i + 1}`)
        .send({ challenge, code: "000000" });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
