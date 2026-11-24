import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Nouveau mot de passe</h1>
      <p className="mt-2 text-asphalte/80">
        Choisissez votre nouveau mot de passe. Par sécurité, tous vos appareils seront déconnectés.
      </p>
      <ResetPasswordForm />
    </div>
  );
}
