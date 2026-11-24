import { Body, Controller, Delete, Get, HttpCode, Inject, Put, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { cartItemSchema, type CartDto, type CartItemInput } from "@lafoulee/shared";
import { ENV, type Env } from "../config/env.js";
import { randomToken } from "../common/crypto.js";
import { clientIp, Public } from "../common/decorators.js";
import { RateLimitService } from "../redis/rate-limit.service.js";
import { CART_TTL_SECONDS, CartService } from "./cart.service.js";

export const CART_COOKIE = "lf_cart";

export function readCartId(req: Request): string | undefined {
  const value = (req.cookies as Record<string, string | undefined> | undefined)?.[CART_COOKIE];
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}

/** Panier (EF04) : accessible sans compte, identifié par un cookie HttpOnly aléatoire. */
@Public()
@Controller("cart")
export class CartController {
  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly cart: CartService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get()
  view(@Req() req: Request): Promise<CartDto> {
    return this.cart.view(readCartId(req));
  }

  @Put("items")
  async setItem(
    @Body({ schema: cartItemSchema }) body: CartItemInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CartDto> {
    await this.rateLimit.consume("cart", clientIp(req), 60, "1 m");
    let cartId = readCartId(req);
    if (!cartId) {
      cartId = randomToken();
      res.cookie(CART_COOKIE, cartId, {
        httpOnly: true,
        secure: this.config.APP_ORIGIN.startsWith("https://"),
        sameSite: "lax",
        path: "/api/v1",
        maxAge: CART_TTL_SECONDS * 1000,
      });
    }
    return this.cart.setQuantity(cartId, body.variantId, body.quantity);
  }

  @Delete()
  @HttpCode(204)
  async clear(@Req() req: Request): Promise<void> {
    await this.cart.clear(readCartId(req));
  }
}
