import type { Metadata } from "next";
import { LinkConfirmation } from "@/components/link-confirmation";

export const metadata: Metadata = { title: "Confirmation de votre demande", robots: { index: false } };

export default function PrivacyConfirmPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Vos données</h1>
      <LinkConfirmation
        endpoint="/privacy/requests/confirm"
        fields={[{ name: "token", pattern: "[A-Za-z0-9_-]{43}" }]}
        intro="Confirmez votre demande. Nous la traitons sous un mois au plus tard."
        buttonLabel="Confirmer ma demande"
        success="Votre demande est enregistrée. Vous recevrez une réponse par email sous un mois au plus tard."
      />
    </div>
  );
}
