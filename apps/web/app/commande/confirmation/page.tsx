import type { Metadata } from "next";
import { OrderConfirmation } from "./order-confirmation";

export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false } };

export default function ConfirmationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-bold uppercase">Votre commande</h1>
      <OrderConfirmation />
    </div>
  );
}
