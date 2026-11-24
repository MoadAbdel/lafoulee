import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import type Stripe from "stripe";
import { Public } from "../common/decorators.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { StripeGateway } from "./stripe.gateway.js";

/**
 * Webhook Stripe (dossier, C23). Trois protections :
 * 1. signature vérifiée sur le corps brut : un tiers ne peut pas simuler un paiement ;
 * 2. chaque événement n'est traité qu'une fois (table stripe_events, RG3) ;
 * 3. les transitions de commande sont conditionnelles (une commande n'est payée qu'une fois).
 */
@Public()
@Controller("payments")
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly stripe: StripeGateway,
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("webhook")
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature?: string) {
    if (!req.rawBody || !signature) throw new BadRequestException("Signature manquante.");
    let event: Stripe.Event;
    try {
      event = this.stripe.verifyWebhook(req.rawBody, signature);
    } catch (error) {
      if (error instanceof Error && error.name === "ServiceUnavailableException") throw error;
      this.logger.warn("Webhook Stripe refusé : signature invalide.");
      throw new BadRequestException("Signature invalide.");
    }

    try {
      await this.prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { received: true, duplicate: true };
      }
      throw error;
    }

    try {
      return await this.handle(event);
    } catch (error) {
      // Échec du traitement : on oublie l'événement pour que le nouvel envoi de Stripe soit traité.
      await this.prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
      throw error;
    }
  }

  private async handle(event: Stripe.Event): Promise<Record<string, unknown>> {
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      const payment = intentId
        ? await this.prisma.payment.findUnique({ where: { stripePaymentIntentId: intentId } })
        : null;
      if (payment && charge.refunded) await this.orders.markRefunded(payment.orderId);
      return { received: true };
    }

    if (event.type.startsWith("payment_intent.")) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const payment = await this.prisma.payment.findUnique({ where: { stripePaymentIntentId: intent.id } });
      if (!payment) return { received: true, ignored: "paiement inconnu" };
      switch (event.type) {
        case "payment_intent.succeeded":
          await this.orders.markPaid(payment.orderId);
          break;
        case "payment_intent.canceled":
          await this.orders.cancel(payment.orderId);
          break;
        case "payment_intent.payment_failed":
          // Le client peut réessayer avec une autre carte sur le même paiement :
          // la commande reste en attente jusqu'à l'expiration de 30 minutes.
          this.logger.log(`Paiement refusé pour la commande ${payment.orderId} (nouvel essai possible).`);
          break;
      }
    }
    return { received: true };
  }
}
