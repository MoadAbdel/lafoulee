"use client";

import { useState, type FormEvent } from "react";
import { privacyRequestSchema } from "@lafoulee/shared";
import { buttonClass, FormErrors, inputClass } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";

/**
 * Demande d'accès ou d'effacement (EF11) pour un visiteur sans compte.
 * Un lien de confirmation part à l'adresse saisie : on ne peut pas demander
 * les données d'une autre personne.
 */
export function PrivacyRequestForm() {
  const [errors, setErrors] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = privacyRequestSchema.safeParse({
      email: String(form.get("email") ?? ""),
      type: String(form.get("type") ?? ""),
    });
    if (!parsed.success) {
      setErrors(["Indiquez une adresse email valide et le type de demande."]);
      return;
    }
    setPending(true);
    setErrors([]);
    const result = await postJson("/privacy/requests", parsed.data);
    setPending(false);
    if (result.ok) setSent(true);
    else setErrors(result.error.messages);
  }

  if (sent) {
    return (
      <p role="status" className="mt-6 border-l-4 border-foret bg-white p-4">
        Si cette adresse est connue, un lien de confirmation vient de lui être envoyé (valable 24 heures).
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4">
      <FormErrors messages={errors} />
      <div>
        <label htmlFor="email" className="font-semibold">
          Adresse email utilisée
        </label>
        <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
      </div>
      <fieldset>
        <legend className="font-semibold">Votre demande</legend>
        <label className="mt-1 flex min-h-11 items-center gap-3">
          <input type="radio" name="type" value="ACCESS" defaultChecked />
          Recevoir une copie de mes données
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input type="radio" name="type" value="DELETION" />
          Effacer mes données
        </label>
      </fieldset>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Envoi..." : "Envoyer la demande"}
      </button>
    </form>
  );
}
