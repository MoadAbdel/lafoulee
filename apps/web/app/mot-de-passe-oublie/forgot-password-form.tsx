"use client";

import { useState, type FormEvent } from "react";
import { forgotPasswordSchema } from "@lafoulee/shared";
import { buttonClass, FormErrors, inputClass } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";

/** La réponse est la même que l'adresse ait un compte ou non : on ne révèle rien. */
export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<string[]>([]);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({
      email: String(new FormData(event.currentTarget).get("email") ?? ""),
    });
    if (!parsed.success) return setErrors(["Indiquez une adresse email valide."]);
    setPending(true);
    setErrors([]);
    const result = await postJson("/auth/password/forgot", parsed.data);
    setPending(false);
    if (result.ok) setSent(true);
    else setErrors(result.error.messages);
  }

  if (sent) {
    return (
      <p role="status" className="mt-6 border-l-4 border-foret bg-white p-3">
        Si cette adresse correspond à un compte, un lien vient d&apos;être envoyé. Il est valable 1 heure et ne sert
        qu&apos;une fois. Pensez à regarder dans vos courriers indésirables.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4">
      <FormErrors messages={errors} />
      <div>
        <label htmlFor="email" className="font-semibold">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Envoi..." : "Recevoir le lien"}
      </button>
    </form>
  );
}
