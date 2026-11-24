import type { Metadata } from "next";
import { VerifyEmail } from "./verify-email";

export const metadata: Metadata = { title: "Confirmation de l'email", robots: { index: false } };

/**
 * Le jeton est lu dans l'URL par le navigateur puis envoyé en POST : un simple
 * passage d'un robot de messagerie (prévisualisation du lien) ne valide rien.
 */
export default function VerifyEmailPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Confirmation de l&apos;email</h1>
      <VerifyEmail />
    </div>
  );
}
