"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { postJson } from "@/lib/client-api";

/** Renouvelle la session (cookie de rafraîchissement), sinon renvoie vers la connexion. */
export function RefreshSession() {
  const router = useRouter();
  useEffect(() => {
    void postJson("/auth/refresh").then((result) => {
      if (result.ok) router.refresh();
      else router.replace("/connexion");
    });
  }, [router]);
  return <p role="status">Reconnexion en cours...</p>;
}
