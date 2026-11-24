"use client";

import Link from "next/link";
import { useState } from "react";
import { tokenSchema } from "@lafoulee/shared";
import { buttonClass, FormErrors } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";

type State = "idle" | "pending" | "done";

export function VerifyEmail() {
  const [state, setState] = useState<State>("idle");
  const [errors, setErrors] = useState<string[]>([]);

  async function confirm() {
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!tokenSchema.safeParse({ token }).success) {
      setErrors(["Ce lien est incomplet. Copiez le lien entier depuis l'email."]);
      return;
    }
    setState("pending");
    const result = await postJson("/auth/verify-email", { token });
    if (result.ok) {
      setState("done");
    } else {
      setState("idle");
      setErrors(result.error.messages);
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="mt-6 border-l-4 border-foret bg-white p-4">
        <p className="font-semibold">Votre adresse est confirmée.</p>
        <Link
          prefetch={false}
          href="/connexion"
          className="mt-2 inline-block font-semibold underline underline-offset-4"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <FormErrors messages={errors} />
      <p>Cliquez sur le bouton pour activer votre compte.</p>
      <button type="button" onClick={confirm} disabled={state === "pending"} className={buttonClass}>
        {state === "pending" ? "Confirmation..." : "Confirmer mon adresse"}
      </button>
    </div>
  );
}
