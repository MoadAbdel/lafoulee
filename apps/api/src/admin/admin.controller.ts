import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import {
  adminOrderQuerySchema,
  adminProductQuerySchema,
  apiKeyCreateSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  imageUploadQuerySchema,
  orderStatusUpdateSchema,
  productCreateSchema,
  productUpdateSchema,
  stockUpdateSchema,
  variantCreateSchema,
  type AdminOrderQuery,
  type AdminProductQuery,
  type ApiKeyCreateInput,
  type CategoryCreateInput,
  type CategoryUpdateInput,
  type ProductCreateInput,
  type ProductUpdateInput,
  type StockUpdateInput,
  type VariantCreateInput,
} from "@lafoulee/shared";
import type { AuditContext } from "../audit/audit.service.js";
import { clientIp, CurrentUser, Roles, type AuthUser } from "../common/decorators.js";
import { ApiKeysService } from "../partner/api-keys.service.js";
import { AdminService } from "./admin.service.js";
import { CatalogAdminService } from "./catalog-admin.service.js";

const pageSchema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

/**
 * Back-office (EA02 à EA08). Toutes les routes exigent une session ADMIN,
 * ouverte avec la double authentification. Chaque modification est journalisée.
 */
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly apiKeys: ApiKeysService,
    private readonly catalogAdmin: CatalogAdminService,
  ) {}

  private context(user: AuthUser, req: Request): AuditContext {
    return { actorId: user.id, ip: clientIp(req) };
  }

  @Get("dashboard")
  dashboard() {
    return this.admin.dashboard();
  }

  @Get("orders")
  orders(@Query({ schema: adminOrderQuerySchema }) query: AdminOrderQuery) {
    return this.admin.listOrders(query);
  }

  @Patch("orders/:id/status")
  orderStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body({ schema: orderStatusUpdateSchema }) body: { status: "READY_FOR_PICKUP" | "SHIPPED" | "COMPLETED" },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.admin.updateOrderStatus(this.context(user, req), id, body.status);
  }

  @Post("orders/:id/refund")
  refund(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.admin.refundOrder(this.context(user, req), id);
  }

  @Get("products")
  products(@Query({ schema: adminProductQuerySchema }) query: AdminProductQuery) {
    return this.admin.listProducts(query);
  }

  @Get("products/:id")
  product(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.admin.getProduct(id);
  }

  @Post("products")
  createProduct(
    @Body({ schema: productCreateSchema }) body: ProductCreateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalogAdmin.createProduct(this.context(user, req), body);
  }

  @Patch("products/:id")
  async updateProduct(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body({ schema: productUpdateSchema }) body: ProductUpdateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const categoryIds = body.categorySlugs ? await this.catalogAdmin.categoryIds(body.categorySlugs) : undefined;
    return this.admin.updateProduct(this.context(user, req), id, body, categoryIds);
  }

  @Post("products/:id/variants")
  createVariant(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body({ schema: variantCreateSchema }) body: VariantCreateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalogAdmin.createVariant(this.context(user, req), id, body);
  }

  /** Photo envoyée en binaire (Content-Type image/...), texte alternatif dans l'adresse. */
  @Post("products/:id/images")
  addImage(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query({ schema: imageUploadQuerySchema }) query: { alt: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalogAdmin.addImage(this.context(user, req), id, req.body, query.alt);
  }

  @Delete("products/:id/images/:imageId")
  removeImage(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Param("imageId", new ParseUUIDPipe()) imageId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalogAdmin.removeImage(this.context(user, req), id, imageId);
  }

  @Get("categories")
  categories() {
    return this.catalogAdmin.listCategories();
  }

  @Post("categories")
  createCategory(
    @Body({ schema: categoryCreateSchema }) body: CategoryCreateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalogAdmin.createCategory(this.context(user, req), body);
  }

  @Patch("categories/:id")
  updateCategory(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body({ schema: categoryUpdateSchema }) body: CategoryUpdateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.catalogAdmin.updateCategory(this.context(user, req), id, body);
  }

  @Delete("categories/:id")
  @HttpCode(204)
  async deleteCategory(
    @Param("id", new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.catalogAdmin.deleteCategory(this.context(user, req), id);
  }

  @Put("stocks")
  async stock(
    @Body({ schema: stockUpdateSchema }) body: StockUpdateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.admin.updateStock(this.context(user, req), body);
    return { status: "OK" };
  }

  @Get("audit")
  audit(@Query({ schema: pageSchema }) query: { page: number }) {
    return this.admin.listAudit(query.page);
  }

  @Get("api-keys")
  keys() {
    return this.apiKeys.list();
  }

  @Post("api-keys")
  createKey(
    @Body({ schema: apiKeyCreateSchema }) body: ApiKeyCreateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.apiKeys.create(this.context(user, req), body);
  }

  @Delete("api-keys/:id")
  revokeKey(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.apiKeys.revoke(this.context(user, req), id);
  }
}
