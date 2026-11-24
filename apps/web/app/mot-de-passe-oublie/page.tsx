import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Mot de passe oublié</h1>
      <p className="mt-2 text-asphalte/80">
        Indiquez l&apos;adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6">
        <Link href="/connexion" className="font-semibold underline underline-offset-4">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
