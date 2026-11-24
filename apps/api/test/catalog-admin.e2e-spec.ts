import request from "supertest";
import { generate } from "otplib";
import type { AdminCategoryDto, AdminProductDetailDto, ProductDetailDto } from "@lafoulee/shared";
import { encrypt } from "../src/common/crypto.js";
import { env } from "../src/config/env.js";
import { PasswordService } from "../src/auth/password.service.js";
import { detectImage } from "../src/admin/image-storage.js";
import { createTestApp, resetRateLimits, uniqueEmail, type TestApp } from "./helpers.js";

const PASSWORD = "Foulee-2026-lyon";
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
// Plus petit PNG valide (1 x 1 pixel).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Gestion du catalogue dans le back-office (EA03) : produits, variantes, photos, catégories. */
describe("Catalogue du back-office (e2e, EA03)", () => {
  let t: TestApp;
  let admin: string;
  let customer: string;
  const stamp = Date.now().toString(36);

  const http = () => request(t.app.getHttpServer());
  const sessionCookie = (res: request.Response) =>
    (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("lf_at="))!.split(";")[0]!;

  beforeAll(async () => {
    t = await createTestApp();
    await resetRateLimits(t.redis);
    const passwordHash = await new PasswordService().hash(PASSWORD);
    const adminEmail = uniqueEmail("admin-catalogue");
    const customerEmail = uniqueEmail("client-catalogue");
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
    admin = sessionCookie(
      await http()
        .post("/api/v1/auth/login/totp")
        .send({ challenge: step1.body.challenge, code: await generate({ secret: SECRET }) })
        .expect(200),
    );
    customer = sessionCookie(
      await http().post("/api/v1/auth/login").send({ email: customerEmail, password: PASSWORD }).expect(200),
    );
  });

  beforeEach(() => resetRateLimits(t.redis));
  afterAll(async () => {
    // Les produits de test ne doivent pas rester dans le catalogue (base locale partagée avec le site).
    await t.prisma.product.deleteMany({ where: { slug: { endsWith: stamp } } });
    await t.app.close();
  });

  it("catégories : création, lien construit, modification, doublon refusé, suppression bloquée si non vide", async () => {
    const name = `Récup ${stamp}`;
    const created = (
      await http()
        .post("/api/v1/admin/categories")
        .set("Cookie", admin)
        .send({ name, description: "Rouleaux, balles et chaussettes de récupération." })
        .expect(201)
    ).body as AdminCategoryDto;
    expect(created.slug).toBe(`recup-${stamp}`);
    expect(created.productCount).toBe(0);

    await http()
      .post("/api/v1/admin/categories")
      .set("Cookie", admin)
      .send({ name, description: "Doublon" })
      .expect(409);

    const updated = (
      await http()
        .patch(`/api/v1/admin/categories/${created.id}`)
        .set("Cookie", admin)
        .send({ position: 9 })
        .expect(200)
    ).body as AdminCategoryDto;
    expect(updated.position).toBe(9);

    const list = (await http().get("/api/v1/admin/categories").set("Cookie", admin).expect(200))
      .body as AdminCategoryDto[];
    expect(list.some((category) => category.id === created.id)).toBe(true);

    const used = list.find((category) => category.productCount > 0)!;
    await http().delete(`/api/v1/admin/categories/${used.id}`).set("Cookie", admin).expect(409);
    await http().delete(`/api/v1/admin/categories/${created.id}`).set("Cookie", admin).expect(204);

    const audit = await t.prisma.auditLog.findMany({ where: { entityId: created.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((entry) => entry.action)).toEqual(["category.create", "category.update", "category.delete"]);
  });

  it("produit : créé en brouillon, invisible ; variante avec stock à 0 ; publié, il apparaît dans le catalogue", async () => {
    const [category] = (await http().get("/api/v1/admin/categories").set("Cookie", admin).expect(200))
      .body as AdminCategoryDto[];
    const product = (
      await http()
        .post("/api/v1/admin/products")
        .set("Cookie", admin)
        .send({
          name: `Essai ${stamp}`,
          brand: "Altivo",
          shortDescription: "Chaussure de test",
          description: "Chaussure créée par le test du back-office.",
          priceCents: 11990,
          categorySlugs: [category!.slug],
        })
        .expect(201)
    ).body as AdminProductDetailDto;
    expect(product.status).toBe("DRAFT");
    expect(product.slug).toBe(`altivo-essai-${stamp}`);
    expect(product.categorySlugs).toEqual([category!.slug]);
    await http().get(`/api/v1/products/${product.slug}`).expect(404);

    const withVariant = (
      await http()
        .post(`/api/v1/admin/products/${product.id}/variants`)
        .set("Cookie", admin)
        .send({ size: "42", color: "Noir" })
        .expect(201)
    ).body as AdminProductDetailDto;
    const stores = await t.prisma.store.count();
    expect(withVariant.variants).toHaveLength(1);
    expect(withVariant.variants[0]!.stocks).toHaveLength(stores);
    expect(withVariant.variants[0]!.stocks.every((stock) => stock.quantity === 0)).toBe(true);
    await http()
      .post(`/api/v1/admin/products/${product.id}/variants`)
      .set("Cookie", admin)
      .send({ size: "42", color: "Noir" })
      .expect(409);

    await http()
      .patch(`/api/v1/admin/products/${product.id}`)
      .set("Cookie", admin)
      .send({ status: "PUBLISHED" })
      .expect(200);
    const detail = (await http().get(`/api/v1/products/${product.slug}`).expect(200)).body as ProductDetailDto;
    expect(detail.name).toBe(`Essai ${stamp}`);

    await http()
      .post("/api/v1/admin/products")
      .set("Cookie", admin)
      .send({
        name: `Essai ${stamp}`,
        brand: "Altivo",
        shortDescription: "x",
        description: "x",
        priceCents: 100,
        categorySlugs: [category!.slug],
      })
      .expect(409); // même lien
    await http()
      .post("/api/v1/admin/products")
      .set("Cookie", admin)
      .send({
        name: "Sans catégorie",
        brand: "Altivo",
        shortDescription: "x",
        description: "x",
        priceCents: 100,
        categorySlugs: ["categorie-inconnue"],
      })
      .expect(400);
  });

  it("catégories d'un produit remplacées ; changement journalisé avant/après", async () => {
    const categories = (await http().get("/api/v1/admin/categories").set("Cookie", admin).expect(200))
      .body as AdminCategoryDto[];
    const product = await t.prisma.product.findFirstOrThrow({ where: { slug: { endsWith: stamp } } });
    const target = categories.at(-1)!.slug;
    const updated = (
      await http()
        .patch(`/api/v1/admin/products/${product.id}`)
        .set("Cookie", admin)
        .send({ categorySlugs: [target] })
        .expect(200)
    ).body as AdminProductDetailDto;
    expect(updated.categorySlugs).toEqual([target]);
    const entry = await t.prisma.auditLog.findFirstOrThrow({
      where: { entityId: product.id, action: "product.update" },
      orderBy: { createdAt: "desc" },
    });
    expect(entry.details).toMatchObject({ categorySlugs: { to: [target] } });
  });

  it("photos : format vérifié sur le contenu, texte alternatif obligatoire, ajout puis suppression", async () => {
    const product = await t.prisma.product.findFirstOrThrow({ where: { slug: { endsWith: stamp } } });
    const url = `/api/v1/admin/products/${product.id}/images`;

    await http()
      .post(`${url}?alt=Vue%20de%20profil`)
      .set("Cookie", admin)
      .set("Content-Type", "image/png")
      .send(Buffer.from("pas une image"))
      .expect(400);
    await http().post(`${url}?alt=ok`).set("Cookie", admin).set("Content-Type", "image/png").send(PNG).expect(400); // alt trop court

    const withImage = (
      await http()
        .post(`${url}?alt=${encodeURIComponent("Chaussure noire vue de profil")}`)
        .set("Cookie", admin)
        .set("Content-Type", "image/png")
        .send(PNG)
        .expect(201)
    ).body as AdminProductDetailDto;
    expect(withImage.images).toHaveLength(1);
    expect(withImage.images[0]!.alt).toBe("Chaussure noire vue de profil");
    expect(t.images.files.get(withImage.images[0]!.url)).toEqual({ size: PNG.length, contentType: "image/png" });

    const publicDetail = (await http().get(`/api/v1/products/${product.slug}`).expect(200)).body as ProductDetailDto;
    expect(publicDetail.images[0]!.url).toBe(withImage.images[0]!.url);

    const removed = (await http().delete(`${url}/${withImage.images[0]!.id}`).set("Cookie", admin).expect(200))
      .body as AdminProductDetailDto;
    expect(removed.images).toHaveLength(0);
    expect(t.images.files.size).toBe(0);
  });

  it("TE05 client connecté ou visiteur : aucune route du catalogue admin", async () => {
    await http().get("/api/v1/admin/categories").expect(401);
    await http().get("/api/v1/admin/categories").set("Cookie", customer).expect(403);
    await http().post("/api/v1/admin/products").set("Cookie", customer).send({}).expect(403);
  });

  it("detectImage reconnaît JPEG, PNG et WebP d'après leurs premiers octets", () => {
    expect(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.extension).toBe("jpg");
    expect(detectImage(PNG)?.extension).toBe("png");
    expect(detectImage(Buffer.from("RIFF\0\0\0\0WEBPVP8 ", "ascii"))?.extension).toBe("webp");
    expect(detectImage(Buffer.from("GIF89a"))).toBeNull();
  });
});
