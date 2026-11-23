import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-4xl font-bold uppercase">Créer un compte</h1>
      <p className="mt-2 text-asphalte/80">
        Un compte sert à suivre vos commandes. Vous pouvez aussi commander sans compte.
      </p>
      <RegisterForm />
      <p className="mt-6 text-sm">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
