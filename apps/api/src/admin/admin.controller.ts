import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import {
  adminOrderQuerySchema,
  adminProductQuerySchema,
  apiKeyCreateSchema,
  orderStatusUpdateSchema,
  productUpdateSchema,
  stockUpdateSchema,
  type AdminOrderQuery,
  type AdminProductQuery,
  type ApiKeyCreateInput,
  type ProductUpdateInput,
  type StockUpdateInput,
} from "@lafoulee/shared";
import type { AuditContext } from "../audit/audit.service.js";
import { clientIp, CurrentUser, Roles, type AuthUser } from "../common/decorators.js";
import { ApiKeysService } from "../partner/api-keys.service.js";
import { AdminService } from "./admin.service.js";

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

  @Patch("products/:id")
  updateProduct(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body({ schema: productUpdateSchema }) body: ProductUpdateInput,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.admin.updateProduct(this.context(user, req), id, body);
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
