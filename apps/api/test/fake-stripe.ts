import Stripe from "stripe";
import type { CreatedPaymentIntent, PaymentIntentStatus } from "../src/payments/stripe.gateway.js";

export const TEST_WEBHOOK_SECRET = "whsec_test_secret_for_e2e";
const stripe = new Stripe("sk_test_dummy");

/**
 * Remplace StripeGateway dans les tests : aucun appel réseau. La vérification
 * de signature utilise la vraie bibliothèque Stripe, avec un secret de test.
 */
export class FakeStripeGateway {
  readonly intents = new Map<string, { orderId: string; amount: number; status: PaymentIntentStatus }>();
  failNextCreate = false;
  private counter = 0;

  createPaymentIntent(orderId: string, amountCents: number): Promise<CreatedPaymentIntent> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      return Promise.reject(new Error("Stripe indisponible"));
    }
    const id = `pi_test_${++this.counter}_${Date.now()}`;
    this.intents.set(id, { orderId, amount: amountCents, status: "requires_payment_method" });
    return Promise.resolve({ id, clientSecret: `${id}_secret_test` });
  }

  retrieveStatus(id: string): Promise<PaymentIntentStatus> {
    return Promise.resolve(this.intents.get(id)?.status ?? "canceled");
  }

  cancel(id: string): Promise<PaymentIntentStatus> {
    const intent = this.intents.get(id);
    if (intent && intent.status !== "succeeded") intent.status = "canceled";
    return Promise.resolve(intent?.status ?? "canceled");
  }

  verifyWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    return stripe.webhooks.constructEvent(rawBody, signature, TEST_WEBHOOK_SECRET);
  }

  /** Construit un événement Stripe signé, comme Stripe l'enverrait. */
  signedEvent(type: string, intentId: string, eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`) {
    const payload = JSON.stringify({
      id: eventId,
      object: "event",
      type,
      data: { object: { id: intentId, object: "payment_intent" } },
    });
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: TEST_WEBHOOK_SECRET });
    return { payload, header };
  }
}
