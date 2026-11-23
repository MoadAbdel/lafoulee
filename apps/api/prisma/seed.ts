/**
 * Jeu de démonstration : 3 boutiques, 6 catégories, 40 produits et leurs variantes.
 * Idempotent : peut être relancé sans créer de doublons (upsert sur les slugs et SKU).
 * Lancement : npx prisma db seed (depuis apps/api).
 */
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

interface SeedData {
  stores: { slug: string; name: string; address: string; postalCode: string; city: string; openingHours: string }[];
  categories: { slug: string; name: string; description: string }[];
  products: {
    slug: string;
    name: string;
    brand: string;
    categorySlugs: string[];
    priceCents: number;
    shortDescription: string;
    description: string;
    attributes: Record<string, string>;
    variants: { size: string; color: string; stock: Record<string, number> }[];
  }[];
}

const data = JSON.parse(readFileSync(new URL("./seed-data/catalog.json", import.meta.url), "utf8")) as SeedData;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL manquante");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function main() {
  const storeIds = new Map<string, string>();
  for (const store of data.stores) {
    const saved = await prisma.store.upsert({ where: { slug: store.slug }, update: store, create: store });
    storeIds.set(store.slug, saved.id);
  }

  const categoryIds = new Map<string, string>();
  for (const [position, category] of data.categories.entries()) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { ...category, position },
      create: { ...category, position },
    });
    categoryIds.set(category.slug, saved.id);
  }

  // Dates de création étalées : le tri "nouveautés" a ainsi un sens.
  const now = Date.now();
  for (const [index, item] of data.products.entries()) {
    const fields = {
      name: item.name,
      brand: item.brand,
      shortDescription: item.shortDescription,
      description: item.description,
      attributes: item.attributes,
      priceCents: item.priceCents,
      status: "PUBLISHED" as const,
    };
    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: fields,
      create: { ...fields, slug: item.slug, createdAt: new Date(now - index * 36 * 3600 * 1000) },
    });

    await prisma.productCategory.deleteMany({ where: { productId: product.id } });
    await prisma.productCategory.createMany({
      data: item.categorySlugs.map((slug) => ({ productId: product.id, categoryId: categoryIds.get(slug)! })),
    });

    for (const [position, variant] of item.variants.entries()) {
      const sku = `${item.slug}-${slugify(variant.size)}-${slugify(variant.color)}`.toUpperCase();
      const savedVariant = await prisma.productVariant.upsert({
        where: { sku },
        update: { size: variant.size, color: variant.color, position },
        create: { productId: product.id, sku, size: variant.size, color: variant.color, position },
      });
      for (const [storeSlug, quantity] of Object.entries(variant.stock)) {
        const storeId = storeIds.get(storeSlug)!;
        await prisma.stock.upsert({
          where: { variantId_storeId: { variantId: savedVariant.id, storeId } },
          update: { quantity, reserved: 0 },
          create: { variantId: savedVariant.id, storeId, quantity },
        });
      }
    }
  }

  const [products, variants, stocks] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.stock.count(),
  ]);
  console.log(
    `Seed terminé : ${data.stores.length} boutiques, ${products} produits, ${variants} variantes, ${stocks} stocks.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
