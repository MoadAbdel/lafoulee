import { Injectable, NotFoundException } from "@nestjs/common";
import {
  PAGE_SIZE,
  type CategoryDto,
  type ProductCardDto,
  type ProductDetailDto,
  type ProductListDto,
  type ProductListQuery,
  type StoreDto,
} from "@lafoulee/shared";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CacheService } from "../redis/cache.service.js";

export const CATALOG_CACHE = "catalog";

/**
 * Transforme une saisie libre en requête tsquery préfixée et sûre :
 * "chaussure trai" -> "chaussure:* & trai:*". Seules les lettres et chiffres
 * sont gardés ; la chaîne est ensuite passée en paramètre SQL, jamais concaténée.
 */
export function toPrefixTsQuery(input: string): string | null {
  const terms = input
    .normalize("NFC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 0)
    .slice(0, 8);
  return terms.length ? terms.map((term) => `${term}:*`).join(" & ") : null;
}

interface PageRow {
  id: string;
  total: bigint;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  listCategories(): Promise<CategoryDto[]> {
    return this.cache.getOrSet(CATALOG_CACHE, "categories", 3600, () =>
      this.prisma.category.findMany({
        orderBy: { position: "asc" },
        select: { slug: true, name: true, description: true },
      }),
    );
  }

  listStores(): Promise<StoreDto[]> {
    return this.cache.getOrSet(CATALOG_CACHE, "stores", 3600, () =>
      this.prisma.store.findMany({
        orderBy: { name: "asc" },
        select: { slug: true, name: true, address: true, postalCode: true, city: true, openingHours: true },
      }),
    );
  }

  listProducts(query: ProductListQuery): Promise<ProductListDto> {
    const key = `products:${query.categorie ?? ""}:${query.q ?? ""}:${query.tri ?? ""}:${query.page}`;
    return this.cache.getOrSet(CATALOG_CACHE, key, 60, () => this.loadProducts(query));
  }

  private async loadProducts(query: ProductListQuery): Promise<ProductListDto> {
    const tsQuery = query.q ? toPrefixTsQuery(query.q) : null;
    const sort = query.tri ?? (tsQuery ? "pertinence" : "nouveautes");
    const offset = (query.page - 1) * PAGE_SIZE;

    const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'PUBLISHED'`];
    if (query.categorie) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM product_categories pc JOIN categories c ON c.id = pc.category_id
        WHERE pc.product_id = p.id AND c.slug = ${query.categorie})`);
    }
    if (tsQuery) conditions.push(Prisma.sql`p.search_vector @@ to_tsquery('fr_unaccent', ${tsQuery})`);

    const orderBy = {
      pertinence: tsQuery
        ? Prisma.sql`ts_rank(p.search_vector, to_tsquery('fr_unaccent', ${tsQuery})) DESC, p.created_at DESC`
        : Prisma.sql`p.created_at DESC`,
      nouveautes: Prisma.sql`p.created_at DESC, p.name ASC`,
      "prix-croissant": Prisma.sql`p.price_cents ASC, p.name ASC`,
      "prix-decroissant": Prisma.sql`p.price_cents DESC, p.name ASC`,
    }[sort];

    const rows = await this.prisma.$queryRaw<PageRow[]>`
      SELECT p.id, COUNT(*) OVER () AS total
      FROM products p
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

    const total = rows.length ? Number(rows[0]!.total) : await this.countProducts(conditions);
    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: {
        images: { orderBy: { position: "asc" }, take: 1 },
        variants: { select: { priceCentsOverride: true, stocks: { select: { quantity: true, reserved: true } } } },
      },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    const items: ProductCardDto[] = rows.flatMap((row) => {
      const product = byId.get(row.id);
      if (!product) return [];
      const prices = product.variants.map((variant) => variant.priceCentsOverride ?? product.priceCents);
      return [
        {
          slug: product.slug,
          name: product.name,
          brand: product.brand,
          shortDescription: product.shortDescription,
          fromPriceCents: prices.length ? Math.min(...prices) : product.priceCents,
          inStock: product.variants.some((variant) =>
            variant.stocks.some((stock) => stock.quantity - stock.reserved > 0),
          ),
          imageUrl: product.images[0]?.blobUrl ?? null,
          imageAlt: product.images[0]?.alt ?? null,
        },
      ];
    });

    return {
      items,
      page: query.page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  /** Page au-delà de la dernière : on renvoie quand même le total exact. */
  private async countProducts(conditions: Prisma.Sql[]): Promise<number> {
    const [row] = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count FROM products p WHERE ${Prisma.join(conditions, " AND ")}`;
    return Number(row?.count ?? 0);
  }

  async getProduct(slug: string): Promise<ProductDetailDto> {
    const product = await this.cache.getOrSet(CATALOG_CACHE, `product:${slug}`, 60, () => this.loadProduct(slug));
    if (!product) throw new NotFoundException("Produit introuvable.");
    return product;
  }

  private async loadProduct(slug: string): Promise<ProductDetailDto | null> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "PUBLISHED" },
      include: {
        categories: { include: { category: true } },
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: { position: "asc" }, include: { stocks: { include: { store: true } } } },
      },
    });
    if (!product) return null;
    const stores = await this.listStores();

    return {
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      shortDescription: product.shortDescription,
      description: product.description,
      attributes: (product.attributes ?? {}) as Record<string, string>,
      categories: product.categories.map(({ category }) => ({
        slug: category.slug,
        name: category.name,
        description: category.description,
      })),
      images: product.images.map((image) => ({ url: image.blobUrl, alt: image.alt })),
      variants: product.variants.map((variant) => {
        const stocks = variant.stocks
          .map((stock) => ({ storeSlug: stock.store.slug, available: Math.max(0, stock.quantity - stock.reserved) }))
          .sort((a, b) => a.storeSlug.localeCompare(b.storeSlug));
        return {
          id: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          priceCents: variant.priceCentsOverride ?? product.priceCents,
          stocks,
          totalAvailable: stocks.reduce((sum, stock) => sum + stock.available, 0),
        };
      }),
      stores,
    };
  }
}
