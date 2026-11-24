import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import {
  checkoutSchema,
  orderAccessSchema,
  type CheckoutInput,
  type CreateOrderResult,
  type OrderDto,
} from "@lafoulee/shared";
import { clientIp, CurrentUser, Public, type AuthUser } from "../common/decorators.js";
import { readCartId } from "../cart/cart.controller.js";
import { RateLimitService } from "../redis/rate-limit.service.js";
import { OrdersService } from "./orders.service.js";

@Controller()
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** Création de commande, avec ou sans compte. */
  @Public()
  @Post("orders")
  async create(
    @Body({ schema: checkoutSchema }) body: CheckoutInput,
    @Req() req: Request,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<CreateOrderResult> {
    // Chaque commande réserve du stock 30 minutes : limites par IP et par panier,
    // pour qu'un visiteur ne puisse pas bloquer tout un modèle en boucle.
    await this.rateLimit.consume("order", clientIp(req), 5, "10 m");
    const cartId = readCartId(req);
    if (cartId) await this.rateLimit.consume("order-cart", cartId, 3, "30 m");
    return this.orders.create(cartId, user?.id ?? null, body);
  }

  /** Suivi d'une commande : réservé à qui détient le jeton reçu à la création. */
  @Public()
  @Get("orders/:id")
  get(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Query({ schema: orderAccessSchema }) query: { jeton: string },
  ): Promise<OrderDto> {
    return this.orders.getWithToken(id, query.jeton);
  }

  /** Historique du client connecté (EF09) : uniquement ses propres commandes. */
  @Get("me/orders")
  mine(@CurrentUser() user: AuthUser): Promise<OrderDto[]> {
    return this.orders.listForUser(user.id);
  }
}
