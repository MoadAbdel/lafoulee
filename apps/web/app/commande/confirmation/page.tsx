import type { Metadata } from "next";
import { OrderConfirmation } from "./order-confirmation";

export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false } };

export default function ConfirmationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Votre commande</h1>
      <OrderConfirmation />
    </div>
  );
}
