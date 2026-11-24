"use client";

import { useRef, useState, type FormEvent } from "react";
import { FormErrors, inputClass } from "@/components/form-errors";
import { notifyAuthChanged, postJson } from "@/lib/client-api";

/** Droits RGPD du client connecté (EF11) : export immédiat et suppression du compte. */
export function MyData() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors([]);
    const result = await postJson("/me/delete", {
      password: String(new FormData(event.currentTarget).get("password") ?? ""),
    });
    setPending(false);
    if (result.ok) {
      dialog.current?.close();
      notifyAuthChanged();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- changement de session : rechargement complet voulu
      window.location.assign("/?compte=supprime");
    } else {
      setErrors(result.error.messages);
    }
  }

  return (
    <section aria-labelledby="titre-donnees" className="mt-10">
      <h2 id="titre-donnees" className="font-display tracking-tight text-3xl font-extrabold">
        Mes données
      </h2>
      <p className="mt-2 text-asphalte/80">
        Téléchargez toutes vos données (format JSON), ou supprimez votre compte. Vos commandes sont gardées 10 ans pour
        la comptabilité, sans aucune information qui vous identifie.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          href="/api/v1/me/data"
          download
          className="min-h-11 content-center border border-asphalte px-5 font-semibold"
        >
          Télécharger mes données
        </a>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className="min-h-11 border border-balise px-5 font-semibold text-balise"
        >
          Supprimer mon compte
        </button>
      </div>
      <dialog ref={dialog} aria-labelledby="titre-suppression" className="m-auto max-w-md p-6 backdrop:bg-asphalte/60">
        <form onSubmit={remove} noValidate className="space-y-4">
          <h3 id="titre-suppression" className="font-display tracking-tight text-2xl font-extrabold">
            Supprimer mon compte ?
          </h3>
          <p>Cette action est définitive. Saisissez votre mot de passe pour confirmer.</p>
          <FormErrors messages={errors} />
          <div>
            <label htmlFor="delete-password" className="font-semibold">
              Mot de passe
            </label>
            <input
              id="delete-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="min-h-11 border border-asphalte px-4 font-semibold"
            >
              Annuler
            </button>
            <button type="submit" disabled={pending} className="min-h-11 bg-balise px-4 font-semibold text-craie">
              {pending ? "Suppression..." : "Supprimer définitivement"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
