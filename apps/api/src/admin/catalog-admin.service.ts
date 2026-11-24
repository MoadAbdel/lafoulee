import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  IMAGES_PER_PRODUCT,
  slugify,
  type AdminCategoryDto,
  type AdminProductDetailDto,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type ProductCreateInput,
  type VariantCreateInput,
} from "@lafoulee/shared";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import { CatalogInvalidationService } from "../catalog/catalog-invalidation.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminService } from "./admin.service.js";
import { detectImage, ImageStorage } from "./image-storage.js";

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Gestion du catalogue dans le back-office (EA03) : création de produits,
 * variantes, photos et catégories. Chaque action est journalisée et invalide
 * les caches du catalogue public.
 */
@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogInvalidationService,
    private readonly admin: AdminService,
    private readonly images: ImageStorage,
  ) {}

  /** Identifiants des catégories demandées ; refuse une catégorie inconnue. */
  async categoryIds(slugs: string[]): Promise<string[]> {
    const unique = [...new Set(slugs)];
    const found = await this.prisma.category.findMany({ where: { slug: { in: unique } }, select: { id: true } });
    if (found.length !== unique.length) throw new BadRequestException("Catégorie inconnue.");
    return found.map((category) => category.id);
  }

  async createProduct(context: AuditContext, input: ProductCreateInput): Promise<AdminProductDetailDto> {
    const slug = input.slug ?? slugify(`${input.brand} ${input.name}`);
    if (!slug) throw new BadRequestException("Impossible de construire le lien du produit : précisez-le.");
    const categoryIds = await this.categoryIds(input.categorySlugs);
    let id: string;
    try {
      ({ id } = await this.prisma.product.create({
        data: {
          slug,
          name: input.name,
          brand: input.brand,
          shortDescription: input.shortDescription,
          description: input.description,
          priceCents: input.priceCents,
          status: "DRAFT", // publié seulement quand il a ses variantes et son stock
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
        select: { id: true },
      }));
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(`Le lien "${slug}" est déjà utilisé.`);
      throw error;
    }
    await this.audit.record(context, "product.create", "product", id, { slug, categories: input.categorySlugs });
    return this.admin.getProduct(id);
  }

  async createVariant(
    context: AuditContext,
    productId: string,
    input: VariantCreateInput,
  ): Promise<AdminProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true, _count: { select: { variants: true } } },
    });
    if (!product) throw new NotFoundException("Produit introuvable.");
    const stores = await this.prisma.store.findMany({ select: { id: true } });
    const sku = slugify(`${product.slug} ${input.size} ${input.color}`).toUpperCase().slice(0, 64);
    try {
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          sku,
          size: input.size,
          color: input.color,
          position: product._count.variants,
          stocks: { create: stores.map((store) => ({ storeId: store.id, quantity: 0 })) },
        },
      });
      await this.audit.record(context, "variant.create", "variant", variant.id, { ...input, sku });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("Cette taille existe déjà dans ce coloris.");
      throw error;
    }
    await this.catalog.catalogChanged();
    return this.admin.getProduct(productId);
  }

  async addImage(context: AuditContext, productId: string, body: unknown, alt: string): Promise<AdminProductDetailDto> {
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException("Envoyez une image JPEG, PNG ou WebP de 4 Mo au plus.");
    }
    const format = detectImage(body);
    if (!format) throw new BadRequestException("Ce fichier n'est pas une image JPEG, PNG ou WebP.");
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { _count: { select: { images: true } } },
    });
    if (!product) throw new NotFoundException("Produit introuvable.");
    const count = product._count.images;
    if (count >= IMAGES_PER_PRODUCT) throw new ConflictException(`${IMAGES_PER_PRODUCT} photos au plus par produit.`);
    const url = await this.images.upload(productId, body, format.contentType, format.extension);
    const image = await this.prisma.productImage.create({ data: { productId, blobUrl: url, alt, position: count } });
    await this.audit.record(context, "product.image.add", "product", productId, { imageId: image.id, alt });
    await this.catalog.catalogChanged();
    return this.admin.getProduct(productId);
  }

  async removeImage(context: AuditContext, productId: string, imageId: string): Promise<AdminProductDetailDto> {
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image) throw new NotFoundException("Photo introuvable.");
    await this.prisma.productImage.delete({ where: { id: imageId } });
    await this.images.remove(image.blobUrl);
    await this.audit.record(context, "product.image.delete", "product", productId, { imageId, alt: image.alt });
    await this.catalog.catalogChanged();
    return this.admin.getProduct(productId);
  }

  async listCategories(): Promise<AdminCategoryDto[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return categories.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
  }

  async createCategory(context: AuditContext, input: CategoryCreateInput): Promise<AdminCategoryDto> {
    const slug = input.slug ?? slugify(input.name);
    if (!slug) throw new BadRequestException("Impossible de construire le lien de la catégorie : précisez-le.");
    try {
      const category = await this.prisma.category.create({
        data: { slug, name: input.name, description: input.description, position: input.position },
      });
      await this.audit.record(context, "category.create", "category", category.id, { slug });
      await this.catalog.catalogChanged();
      return { ...category, productCount: 0 };
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException(`Le lien "${slug}" est déjà utilisé.`);
      throw error;
    }
  }

  async updateCategory(context: AuditContext, id: string, input: CategoryUpdateInput): Promise<AdminCategoryDto> {
    const before = await this.prisma.category.findUnique({ where: { id } });
    if (!before) throw new NotFoundException("Catégorie introuvable.");
    const { _count, ...category } = await this.prisma.category.update({
      where: { id },
      data: input,
      include: { _count: { select: { products: true } } },
    });
    const changes = Object.fromEntries(
      Object.entries(input).map(([key, to]) => [key, { from: before[key as keyof typeof before], to }]),
    ) as Prisma.InputJsonValue;
    await this.audit.record(context, "category.update", "category", id, changes);
    await this.catalog.catalogChanged();
    return { ...category, productCount: _count.products };
  }

  /** Une catégorie qui contient encore des produits n'est pas supprimée : ils deviendraient introuvables. */
  async deleteCategory(context: AuditContext, id: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException("Catégorie introuvable.");
    if (category._count.products > 0) {
      throw new ConflictException(
        `${category._count.products} produit(s) sont dans cette catégorie : déplacez-les avant de la supprimer.`,
      );
    }
    await this.prisma.category.delete({ where: { id } });
    await this.audit.record(context, "category.delete", "category", id, { slug: category.slug });
    await this.catalog.catalogChanged();
  }
}
