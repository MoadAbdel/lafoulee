import { Body, Controller, Get, HttpCode, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { Public } from "../common/decorators.js";
import { InternalSecretGuard } from "../common/internal-secret.guard.js";
import { OrdersService } from "../orders/orders.service.js";
import { NotificationsService } from "./notifications.service.js";

const orderPaidMessage = z.strictObject({ orderId: z.uuid() });

/** Routes internes : jamais appelées par un navigateur. Session non requise, secret exigé. */
@Public()
@UseGuards(InternalSecretGuard)
@Controller("internal")
export class InternalController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly orders: OrdersService,
  ) {}

  /** Appelée par le consommateur Vercel Queues (service web) pour chaque commande payée. */
  @Post("notifications/order-paid")
  @HttpCode(200)
  async orderPaid(@Body({ schema: orderPaidMessage }) body: { orderId: string }) {
    return { result: await this.notifications.sendOrderConfirmation(body.orderId) };
  }

  /**
   * Tâche de nuit (Vercel Cron, une fois par jour sur l'offre Hobby) :
   * libère les réservations des paiements abandonnés.
   */
  @Get("cron/nightly")
  async nightly() {
    return { expired: await this.orders.expireAbandoned(500) };
  }
}
