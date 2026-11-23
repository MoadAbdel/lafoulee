"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useState, type FormEvent } from "react";
import { formatPrice, type CreateOrderResult } from "@lafoulee/shared";
import { buttonClass, FormErrors } from "@/components/form-errors";

let stripePromise: Promise<Stripe | null> | undefined;
function getStripe() {
  stripePromise ??= loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");
  return stripePromise;
}

export function confirmationUrl(order: Pick<CreateOrderResult, "orderId" | "accessToken">, origin: string): string {
  const params = new URLSearchParams({ commande: order.orderId, jeton: order.accessToken });
  return `${origin}/commande/confirmation?${params}`;
}

/**
 * Paiement Stripe (Payment Element) : la carte est saisie dans un cadre Stripe,
 * nos serveurs ne la voient jamais (SAQ A). 3D Secure est géré par Stripe.
 */
export function PaymentStep({ order }: { order: CreateOrderResult }) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret: order.clientSecret,
        locale: "fr",
        appearance: {
          theme: "stripe",
          variables: { colorPrimary: "#b4400b", colorText: "#1c1f22", borderRadius: "0px" },
        },
      }}
    >
      <PaymentForm order={order} />
    </Elements>
  );
}

function PaymentForm({ order }: { order: CreateOrderResult }) {
  const stripe = useStripe();
  const elements = useElements();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPending(true);
    setErrors([]);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: confirmationUrl(order, window.location.origin) },
    });
    // Ici seulement en cas d'erreur : sinon Stripe redirige vers la page de confirmation.
    setPending(false);
    setErrors([error.message ?? "Le paiement n'a pas abouti. Vous pouvez réessayer."]);
  }

  return (
    <form onSubmit={pay} className="mt-4 space-y-4">
      <FormErrors messages={errors} />
      <p className="text-sm">Commande n°{order.number} : vos articles sont réservés pendant 30 minutes.</p>
      <PaymentElement />
      <button type="submit" disabled={!stripe || pending} className={buttonClass}>
        {pending ? "Paiement en cours..." : `Payer ${formatPrice(order.totalCents)}`}
      </button>
      <p className="text-xs text-asphalte/70">
        Site de démonstration en mode test Stripe : utilisez la carte 4242 4242 4242 4242, une date future et un code
        quelconque.
      </p>
    </form>
  );
}
