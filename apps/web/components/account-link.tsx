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
      void getJson<SessionUser>("/auth/me").then((result) => setUser(result.ok ? result.data : null));
    };
    check();
    window.addEventListener(AUTH_EVENT, check);
    return () => window.removeEventListener(AUTH_EVENT, check);
  }, []);

  const className = "min-h-11 content-center font-semibold underline-offset-4 hover:underline";
  if (!user) {
    return (
      <Link href="/connexion" className={className}>
        Connexion
      </Link>
    );
  }
  return (
    <Link href={user.role === "ADMIN" ? "/admin" : "/compte"} className={className}>
      {user.role === "ADMIN" ? "Back-office" : "Mon compte"}
    </Link>
  );
}
