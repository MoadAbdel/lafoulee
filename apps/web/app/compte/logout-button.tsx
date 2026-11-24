"use client";

import { useState } from "react";
import { notifyAuthChanged, postJson } from "@/lib/client-api";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await postJson("/auth/logout");
        notifyAuthChanged();
        // Rechargement complet : aucune page préchargée pendant la session ne doit resservir.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- changement de session : rechargement complet voulu
        window.location.assign("/");
      }}
      className="min-h-12 w-full border border-asphalte px-6 font-semibold"
    >
      {pending ? "Déconnexion..." : "Se déconnecter"}
    </button>
  );
}
