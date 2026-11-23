import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import Stripe from "stripe";
import { ENV, type Env } from "../config/env.js";

export type PaymentIntentStatus = Stripe.PaymentIntent.Status;

export interface CreatedPaymentIntent {
  id: string;
  clientSecret: string;
}

/**
 * Seul point de contact avec Stripe (dossier, C10 : adaptateur isolé).
 * Les tests remplacent cette classe : aucun appel réseau en CI.
 */
@Injectable()
export class StripeGateway {
  private readonly stripe: Stripe;

  constructor(@Inject(ENV) private readonly config: Env) {
    this.stripe = new Stripe(config.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 10_000 });
  }

  /**
   * Le montant vient toujours du serveur. La clé d'idempotence (identifiant de commande)
   * empêche un double paiement si la requête est rejouée.
   */
  async createPaymentIntent(orderId: string, amountCents: number, email: string): Promise<CreatedPaymentIntent> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        receipt_email: email,
        metadata: { orderId },
      },
      { idempotencyKey: `order-${orderId}` },
    );
    if (!intent.client_secret) throw new Error("PaymentIntent sans client_secret");
    return { id: intent.id, clientSecret: intent.client_secret };
  }

  async retrieveStatus(paymentIntentId: string): Promise<PaymentIntentStatus> {
    return (await this.stripe.paymentIntents.retrieve(paymentIntentId)).status;
  }

  /** Annule un paiement abandonné. Renvoie le statut final (un paiement déjà réussi ne s'annule pas). */
  async cancel(paymentIntentId: string): Promise<PaymentIntentStatus> {
    const current = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (current.status === "succeeded" || current.status === "canceled") return current.status;
    return (await this.stripe.paymentIntents.cancel(paymentIntentId)).status;
  }

  /** Remboursement intégral (back-office). La clé d'idempotence évite un double remboursement. */
  async refund(paymentIntentId: string): Promise<void> {
    await this.stripe.refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey: `refund-${paymentIntentId}` },
    );
  }

  /** Vérifie la signature du webhook (corps brut + secret du point de terminaison). */
  verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.config.STRIPE_WEBHOOK_SECRET) {
      throw new ServiceUnavailableException("Webhook Stripe non configuré.");
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, this.config.STRIPE_WEBHOOK_SECRET);
  }
}
