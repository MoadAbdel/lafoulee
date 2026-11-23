import type { Metadata } from "next";
import { PrivacyRequestForm } from "./privacy-request-form";

export const metadata: Metadata = { title: "Demande concernant vos données", robots: { index: false } };

export default function PrivacyRequestPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-4xl font-bold uppercase">Vos données</h1>
      <p className="mt-2 text-asphalte/80">
        Pour une commande sans compte ou la newsletter. Avec un compte, tout se fait directement dans Mon compte.
      </p>
      <PrivacyRequestForm />
    </div>
  );
}
