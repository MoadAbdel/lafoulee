"use client";

import { useState, type FormEvent } from "react";
import { newsletterSchema } from "@lafoulee/shared";
import { postJson } from "@/lib/client-api";

/** Inscription à la newsletter (EF10) : un email de confirmation suit (double opt-in). */
export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = newsletterSchema.safeParse({ email: String(new FormData(event.currentTarget).get("email") ?? "") });
    if (!parsed.success) {
      setError("Adresse email invalide.");
      return;
    }
    setState("pending");
    setError("");
    const result = await postJson("/newsletter", parsed.data);
    if (result.ok) setState("sent");
    else {
      setState("idle");
      setError(result.error.messages[0] ?? "Inscription impossible.");
    }
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-sm">
        Vérifiez votre boîte mail : un lien de confirmation vient de partir.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      <label htmlFor="newsletter-email" className="block text-sm font-semibold">
        Newsletter : nouveautés et produits de saison
      </label>
      <div className="flex">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-describedby={error ? "newsletter-erreur" : undefined}
          className="min-h-11 min-w-0 flex-1 border border-craie/40 bg-asphalte px-3 text-craie"
        />
        <button
          type="submit"
          disabled={state === "pending"}
          className="min-h-11 bg-balise px-4 font-semibold text-craie"
        >
          S&apos;inscrire
        </button>
      </div>
      {error && (
        <p id="newsletter-erreur" role="alert" className="text-sm">
          {error}
        </p>
      )}
      <p className="text-xs text-craie/70">Un email par mois au plus. Désinscription en un clic.</p>
    </form>
  );
}
