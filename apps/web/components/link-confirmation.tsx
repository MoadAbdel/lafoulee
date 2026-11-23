"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClass, FormErrors } from "./form-errors";
import { postJson } from "@/lib/client-api";

/**
 * Confirmation d'une action reçue par email (lien à usage unique).
 * Rien n'est validé à l'ouverture de la page : il faut cliquer. Un robot de
 * messagerie qui ouvre le lien pour en faire un aperçu ne confirme donc rien.
 */
export function LinkConfirmation({
  endpoint,
  fields,
  intro,
  buttonLabel,
  success,
}: {
  endpoint: string;
  /** Paramètres attendus dans l'URL, avec leur format (expression régulière). */
  fields: { name: string; pattern: string }[];
  intro: string;
  buttonLabel: string;
  success: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [errors, setErrors] = useState<string[]>([]);

  async function confirm() {
    const params = new URLSearchParams(window.location.search);
    const body = Object.fromEntries(fields.map((field) => [field.name, params.get(field.name) ?? ""]));
    if (fields.some((field) => !new RegExp(`^${field.pattern}$`).test(body[field.name] ?? ""))) {
      setErrors(["Ce lien est incomplet. Copiez le lien entier depuis l'email."]);
      return;
    }
    setState("pending");
    const result = await postJson(endpoint, body);
    if (result.ok) setState("done");
    else {
      setState("idle");
      setErrors(result.error.messages);
    }
  }

  if (state === "done") {
    return (
      <div role="status" className="mt-6 border-l-4 border-foret bg-white p-4">
        <p className="font-semibold">{success}</p>
        <Link href="/" className="mt-2 inline-block underline underline-offset-4">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <FormErrors messages={errors} />
      <p>{intro}</p>
      <button type="button" onClick={confirm} disabled={state === "pending"} className={buttonClass}>
        {state === "pending" ? "Confirmation..." : buttonLabel}
      </button>
    </div>
  );
}
