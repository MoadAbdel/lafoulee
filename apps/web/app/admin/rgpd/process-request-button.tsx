"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { GdprRequestType } from "@lafoulee/shared";
import { apiRequest } from "@/lib/client-api";

export function ProcessRequestButton({ id, type }: { id: string; type: GdprRequestType }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const label = type === "ACCESS" ? "Envoyer la copie" : "Effacer les données";

  async function run() {
    if (type === "DELETION" && !window.confirm("Effacer définitivement les données liées à cette adresse ?")) return;
    setPending(true);
    const result = await apiRequest("POST", `/admin/gdpr-requests/${id}/process`);
    setPending(false);
    if (result.ok) router.refresh();
    else setError(result.error.messages[0] ?? "Échec du traitement.");
  }

  return (
    <>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="min-h-11 bg-asphalte px-3 font-semibold text-craie disabled:opacity-60"
      >
        {pending ? "Traitement..." : label}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-balise">
          {error}
        </span>
      )}
    </>
  );
}
