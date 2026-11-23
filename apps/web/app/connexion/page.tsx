import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="font-display text-4xl font-bold uppercase">Connexion</h1>
      <LoginForm />
      <p className="mt-6 text-sm">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold underline underline-offset-4">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
