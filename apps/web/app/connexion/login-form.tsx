"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { LoginResult } from "@lafoulee/shared";
import { buttonClass, FormErrors, inputClass } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";

/** Connexion en une étape (clients) ou deux étapes avec code TOTP (administrateurs). */
export function LoginForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  function done() {
    router.push("/compte");
    router.refresh();
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    setPending(true);
    setErrors([]);
    const result = await postJson<LoginResult>("/auth/login", { email, password: String(form.get("password") ?? "") });
    setPending(false);
    if (!result.ok) {
      setUnverifiedEmail(result.error.code === "EMAIL_NOT_VERIFIED" ? email : null);
      setErrors(result.error.messages);
      return;
    }
    if (result.data.status === "TOTP_REQUIRED") setChallenge(result.data.challenge);
    else done();
  }

  async function onCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setPending(true);
    setErrors([]);
    const result = await postJson<LoginResult>("/auth/login/totp", { challenge, code });
    setPending(false);
    if (result.ok) done();
    else if (result.error.status === 401 && result.error.messages[0]?.includes("expirée")) {
      setChallenge(null);
      setErrors(result.error.messages);
    } else setErrors(result.error.messages);
  }

  async function resend() {
    if (!unverifiedEmail) return;
    await postJson("/auth/resend-verification", { email: unverifiedEmail });
    setResent(true);
  }

  if (challenge) {
    return (
      <form onSubmit={onCode} noValidate className="mt-6 space-y-4">
        <FormErrors messages={errors} />
        <div>
          <label htmlFor="code" className="font-semibold">
            Code de votre application d&apos;authentification
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={7}
            required
            autoFocus
            aria-describedby="code-aide"
            className={`${inputClass} text-2xl tracking-widest`}
          />
          <p id="code-aide" className="mt-1 text-sm text-asphalte/80">
            6 chiffres. Le code change toutes les 30 secondes.
          </p>
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Vérification..." : "Valider"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onPassword} noValidate className="mt-6 space-y-4">
      <FormErrors messages={errors} />
      {unverifiedEmail && (
        <p className="text-sm">
          {resent ? (
            <span role="status">Un nouveau lien vient d&apos;être envoyé.</span>
          ) : (
            <button type="button" onClick={resend} className="font-semibold underline underline-offset-4">
              Renvoyer l&apos;email de confirmation
            </button>
          )}
        </p>
      )}
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
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
