import type { Metadata } from "next";
import { LinkConfirmation } from "@/components/link-confirmation";

export const metadata: Metadata = { title: "Inscription à la newsletter", robots: { index: false } };

export default function NewsletterConfirmPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Newsletter</h1>
      <LinkConfirmation
        endpoint="/newsletter/confirm"
        fields={[{ name: "token", pattern: "[A-Za-z0-9_-]{43}" }]}
        intro="Confirmez votre inscription à la newsletter de La Foulée."
        buttonLabel="Confirmer mon inscription"
        success="Votre inscription est confirmée. Merci !"
      />
    </div>
  );
}
