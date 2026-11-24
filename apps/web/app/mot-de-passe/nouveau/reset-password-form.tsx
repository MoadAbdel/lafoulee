"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { resetPasswordSchema } from "@lafoulee/shared";
import { buttonClass, FormErrors, inputClass } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";

/** Le jeton vient du lien reçu par email ; il n'est lu qu'à l'envoi du formulaire. */
export function ResetPasswordForm() {
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "")) {
      return setErrors(["Les deux mots de passe ne sont pas identiques."]);
    }
    const parsed = resetPasswordSchema.safeParse({
      token: new URLSearchParams(window.location.search).get("token") ?? "",
      newPassword,
    });
    if (!parsed.success) {
      const tokenProblem = parsed.error.issues.some((issue) => issue.path[0] === "token");
      return setErrors(
        tokenProblem
          ? ["Ce lien est incomplet. Copiez le lien entier depuis l'email."]
          : [...new Set(parsed.error.issues.map((issue) => issue.message))],
      );
    }
    setPending(true);
    setErrors([]);
    const result = await postJson("/auth/password/reset", parsed.data);
    setPending(false);
    if (result.ok) setDone(true);
    else setErrors(result.error.messages);
  }

  if (done) {
    return (
      <p role="status" className="mt-6 border-l-4 border-foret bg-white p-3">
        Votre mot de passe est changé.{" "}
        <Link prefetch={false} href="/connexion" className="font-semibold underline underline-offset-4">
          Connectez-vous
        </Link>{" "}
        avec le nouveau.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4">
      <FormErrors messages={errors} />
      <div>
        <label htmlFor="newPassword" className="font-semibold">
          Nouveau mot de passe
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          aria-describedby="regle"
          className={inputClass}
        />
        <p id="regle" className="mt-1 text-sm text-asphalte/80">
          12 caractères minimum, avec au moins 3 types : minuscules, majuscules, chiffres, caractères spéciaux.
        </p>
      </div>
      <div>
        <label htmlFor="confirmPassword" className="font-semibold">
          Confirmer le mot de passe
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Enregistrement..." : "Enregistrer le mot de passe"}
      </button>
    </form>
  );
}
