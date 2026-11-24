import type { Metadata } from "next";
import { Checkout } from "./checkout";

export const metadata: Metadata = { title: "Commande", robots: { index: false } };

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Commande</h1>
      <Checkout />
    </div>
  );
}
