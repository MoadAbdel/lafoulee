import type { Metadata } from "next";
import { LinkConfirmation } from "@/components/link-confirmation";

export const metadata: Metadata = { title: "Désinscription de la newsletter", robots: { index: false } };

export default function UnsubscribePage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Désinscription</h1>
      <LinkConfirmation
        endpoint="/newsletter/unsubscribe"
        fields={[
          { name: "email", pattern: "[^@\\s]+@[^@\\s]+" },
          { name: "signature", pattern: "[a-f0-9]{64}" },
        ]}
        intro="Vous ne recevrez plus la newsletter, et votre adresse sera effacée de notre liste."
        buttonLabel="Me désinscrire"
        success="C'est fait : votre adresse est effacée de la liste."
      />
    </div>
  );
}
