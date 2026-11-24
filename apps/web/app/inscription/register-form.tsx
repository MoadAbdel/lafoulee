"use client";

import { useState, type FormEvent } from "react";
import { registerSchema } from "@lafoulee/shared";
import { buttonClass, FormErrors, inputClass } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";

export function RegisterForm() {
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const input = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      firstName: String(form.get("firstName") ?? "").trim() || undefined,
    };
    // Même schéma que l'API : l'erreur s'affiche sans aller-retour réseau.
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setPending(true);
    const result = await postJson("/auth/register", parsed.data);
    setPending(false);
    if (result.ok) setSentTo(parsed.data.email);
    else setErrors(result.error.messages);
  }

  if (sentTo) {
    return (
      <div role="status" className="mt-6 border-l-4 border-foret bg-white p-4">
        <p className="font-semibold">Vérifiez votre boîte mail.</p>
        <p className="mt-1">
          Si l&apos;adresse {sentTo} n&apos;a pas encore de compte, vous allez recevoir un lien de confirmation, valable
          24 heures.
        </p>
        <p className="mt-3">
          <strong>Conseil :</strong> une fois connecté, activez la double authentification dans « Mon compte ». Un code
          de votre téléphone vous sera demandé en plus du mot de passe : votre compte reste protégé même si ce mot de
          passe est dérobé.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
      <FormErrors messages={errors} />
      <div>
        <label htmlFor="firstName" className="font-semibold">
          Prénom <span className="font-normal text-asphalte/70">(facultatif)</span>
        </label>
        <input id="firstName" name="firstName" autoComplete="given-name" maxLength={60} className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="font-semibold">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className="font-semibold">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="password-aide"
          className={inputClass}
        />
        <p id="password-aide" className="mt-1 text-sm text-asphalte/80">
          12 caractères minimum, avec au moins 3 types parmi : minuscules, majuscules, chiffres, caractères spéciaux.
        </p>
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Création en cours..." : "Créer mon compte"}
      </button>
    </form>
  );
}
