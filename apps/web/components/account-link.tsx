"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SessionUser } from "@lafoulee/shared";
import { AUTH_EVENT, getJson } from "@/lib/client-api";

/**
 * Lien de l'en-tête : "Connexion" pour un visiteur, "Mon compte" une fois connecté.
 * Le cookie de session est HttpOnly : on demande donc la session à l'API, comme le
 * compteur du panier. L'en-tête reste statique (Partial Prerendering).
 */
export function AccountLink() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const check = () => {
      void getJson<{ user: SessionUser | null }>("/auth/session").then((result) =>
        setUser(result.ok ? result.data.user : null),
      );
    };
    check();
    window.addEventListener(AUTH_EVENT, check);
    return () => window.removeEventListener(AUTH_EVENT, check);
  }, []);

  const className = "min-h-11 content-center font-semibold underline-offset-4 hover:underline";
  if (!user) {
    return (
      <Link prefetch={false} href="/connexion" className={className}>
        Connexion
      </Link>
    );
  }
  const compte = (
    <Link prefetch={false} href="/compte" className={className}>
      Mon compte
    </Link>
  );
  if (user.role !== "ADMIN") return compte;
  // Administrateur : le back-office et son propre compte (mot de passe, 2FA, données).
  return (
    <>
      <Link prefetch={false} href="/admin" className={className}>
        Back-office
      </Link>
      {compte}
    </>
  );
}
