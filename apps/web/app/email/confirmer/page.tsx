import type { Metadata } from "next";
import { LinkConfirmation } from "@/components/link-confirmation";

export const metadata: Metadata = { title: "Confirmer la nouvelle adresse", robots: { index: false } };

export default function ConfirmEmailChangePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Nouvelle adresse email</h1>
      <LinkConfirmation
        endpoint="/auth/email-change/confirm"
        fields={[{ name: "token", pattern: "[A-Za-z0-9_-]{43}" }]}
        intro="Confirmez que cette adresse devient celle de votre compte La Foulée."
        buttonLabel="Confirmer ma nouvelle adresse"
        success="C'est fait : utilisez désormais cette adresse pour vous connecter."
      />
    </div>
  );
}
