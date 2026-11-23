import request from "supertest";
import type { ProductDetailDto, ProductListDto } from "@lafoulee/shared";
import { createTestApp, type TestApp } from "./helpers.js";

/** Nécessite la base de démonstration (npx prisma db seed). */
describe("Catalogue (e2e)", () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  const http = () => request(t.app.getHttpServer());

  it("TB31b GET /health : 200 quand la base et Redis répondent", async () => {
    const res = await http().get("/api/v1/health").expect(200);
    expect(res.body).toMatchObject({ status: "ok", checks: { database: true, redis: true } });
  });

  it("TF01/EF01 liste paginée de 12 produits publiés", async () => {
    const res = await http().get("/api/v1/products?page=1").expect(200);
    const body = res.body as ProductListDto;
    expect(body.items).toHaveLength(12);
    expect(body.total).toBeGreaterThanOrEqual(40);
    expect(body.totalPages).toBe(Math.ceil(body.total / 12));
  });

  it("filtre par catégorie et trie par prix", async () => {
    const res = await http().get("/api/v1/products?categorie=nutrition&tri=prix-croissant").expect(200);
    const prices = (res.body as ProductListDto).items.map((item) => item.fromPriceCents);
    expect(prices.length).toBeGreaterThan(0);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("TB01 recherche par préfixe et sans tenir compte des accents", async () => {
    const prefix = (await http().get("/api/v1/products?q=trai").expect(200)).body as ProductListDto;
    expect(prefix.total).toBeGreaterThan(0);
    const accents = (await http().get("/api/v1/products?q=legere").expect(200)).body as ProductListDto;
    const withAccents = (await http().get("/api/v1/products?q=légère").expect(200)).body as ProductListDto;
    expect(accents.total).toBe(withAccents.total);
  });

  it("TB02 paramètres hors bornes refusés (400), paramètres de campagne ignorés", async () => {
    await http().get("/api/v1/products?page=0").expect(400);
    await http().get("/api/v1/products?page=10000").expect(400);
    await http().get("/api/v1/products?tri=inconnu").expect(400);
    await http().get("/api/v1/products?categorie=..%2Fetc").expect(400);
    await http().get("/api/v1/products?utm_source=newsletter").expect(200);
  });

  it("une page au-delà de la dernière renvoie une liste vide et le bon total", async () => {
    const res = await http().get("/api/v1/products?page=400").expect(200);
    expect((res.body as ProductListDto).items).toHaveLength(0);
    expect((res.body as ProductListDto).total).toBeGreaterThan(0);
  });

  it("TF03/EF03 fiche produit : variantes et stock disponible par boutique", async () => {
    const list = (await http().get("/api/v1/products?categorie=chaussures-trail").expect(200)).body as ProductListDto;
    const slug = list.items[0]!.slug;
    const product = (await http().get(`/api/v1/products/${slug}`).expect(200)).body as ProductDetailDto;
    expect(product.variants.length).toBeGreaterThan(0);
    expect(product.stores).toHaveLength(3);
    for (const variant of product.variants) {
      expect(variant.stocks).toHaveLength(3);
      expect(variant.totalAvailable).toBe(variant.stocks.reduce((sum, stock) => sum + stock.available, 0));
      for (const stock of variant.stocks) expect(stock.available).toBeGreaterThanOrEqual(0);
    }
  });

  it("le stock réservé n'est pas compté comme disponible", async () => {
    const variant = await t.prisma.productVariant.findFirstOrThrow({
      where: { stocks: { some: { quantity: { gte: 2 } } } },
      include: { product: true, stocks: { include: { store: true } } },
    });
    const stock = variant.stocks.find((s) => s.quantity >= 2)!;
    await t.prisma.stock.update({
      where: { variantId_storeId: { variantId: variant.id, storeId: stock.storeId } },
      data: { reserved: 1 },
    });
    await t.redis.incr("cache-version:catalog");
    try {
      const product = (await http().get(`/api/v1/products/${variant.product.slug}`).expect(200))
        .body as ProductDetailDto;
      const dto = product.variants.find((v) => v.id === variant.id)!;
      expect(dto.stocks.find((s) => s.storeSlug === stock.store.slug)!.available).toBe(stock.quantity - 1);
    } finally {
      await t.prisma.stock.update({
        where: { variantId_storeId: { variantId: variant.id, storeId: stock.storeId } },
        data: { reserved: 0 },
      });
      await t.redis.incr("cache-version:catalog");
    }
  });

  it("produit inconnu ou slug invalide : 404 ou 400", async () => {
    await http().get("/api/v1/products/inexistant").expect(404);
    await http().get("/api/v1/products/Majuscules!").expect(400);
  });

  it("boutiques et catégories publiques", async () => {
    expect((await http().get("/api/v1/stores").expect(200)).body).toHaveLength(3);
    expect((await http().get("/api/v1/categories").expect(200)).body).toHaveLength(6);
  });

  it("en-têtes de sécurité et absence de x-powered-by", async () => {
    const res = await http().get("/api/v1/health");
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
