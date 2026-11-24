"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { notifyAuthChanged, postJson } from "@/lib/client-api";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await postJson("/auth/logout");
        notifyAuthChanged();
        router.push("/");
        router.refresh();
      }}
      className="min-h-12 w-full border border-asphalte px-6 font-semibold"
    >
      {pending ? "Déconnexion..." : "Se déconnecter"}
    </button>
  );
}
