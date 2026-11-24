"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  emailChangeSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
  twoFactorSetupSchema,
  type AccountProfileDto,
  type TwoFactorSetupDto,
} from "@lafoulee/shared";
import { FormErrors, inputClass } from "@/components/form-errors";
import { apiRequest, notifyAuthChanged, postJson } from "@/lib/client-api";

const sectionClass = "space-y-3 border border-asphalte/15 bg-white p-4";
const titleClass = "font-display text-2xl font-extrabold tracking-tight";
const submitClass = "min-h-11 bg-asphalte px-5 font-semibold text-craie disabled:opacity-60";
const issues = (error: { issues: { message: string }[] }) => [...new Set(error.issues.map((issue) => issue.message))];
const field = (form: FormData, name: string) => String(form.get(name) ?? "");

/** Réglages du compte (EF09) : informations, email, mot de passe, double authentification. */
export function AccountSettings({ profile }: { profile: AccountProfileDto }) {
  return (
    <div className="mt-8 space-y-6">
      {!profile.twoFactorEnabled && (
        <p className="border-l-4 border-foret bg-white p-3">
          <strong>Conseil :</strong> activez la double authentification ci-dessous. Même si votre mot de passe était
          dérobé, personne ne pourrait se connecter sans votre téléphone.
        </p>
      )}
      <ProfileForm profile={profile} />
      <EmailForm email={profile.email} />
      <PasswordForm />
      <TwoFactor profile={profile} />
    </div>
  );
}

function ProfileForm({ profile }: { profile: AccountProfileDto }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = field(new FormData(event.currentTarget), "firstName").trim();
    const parsed = profileUpdateSchema.safeParse({ firstName: value === "" ? null : value });
    if (!parsed.success) return setErrors(issues(parsed.error));
    setErrors([]);
    const result = await apiRequest("PATCH", "/me/profile", parsed.data);
    if (!result.ok) return setErrors(result.error.messages);
    setMessage("Informations enregistrées.");
    notifyAuthChanged();
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="titre-infos" className={sectionClass}>
      <h2 id="titre-infos" className={titleClass}>
        Mes informations
      </h2>
      <FormErrors messages={errors} />
      <div>
        <label htmlFor="firstName" className="font-semibold">
          Prénom (facultatif)
        </label>
        <input
          id="firstName"
          name="firstName"
          autoComplete="given-name"
          maxLength={60}
          defaultValue={profile.firstName ?? ""}
          className={inputClass}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className={submitClass}>
          Enregistrer
        </button>
        <p role="status" className="text-sm text-foret">
          {message}
        </p>
      </div>
    </form>
  );
}

function EmailForm({ email }: { email: string }) {
  const [errors, setErrors] = useState<string[]>([]);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = emailChangeSchema.safeParse({
      newEmail: field(form, "newEmail"),
      currentPassword: field(form, "emailPassword"),
    });
    if (!parsed.success) return setErrors(issues(parsed.error));
    setPending(true);
    setErrors([]);
    const result = await postJson("/me/email", parsed.data);
    setPending(false);
    if (result.ok) setSentTo(parsed.data.newEmail);
    else setErrors(result.error.messages);
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="titre-email" className={sectionClass}>
      <h2 id="titre-email" className={titleClass}>
        Adresse email
      </h2>
      <p>
        Adresse actuelle : <strong>{email}</strong>
      </p>
      {sentTo ? (
        <p role="status" className="text-foret">
          Un lien de confirmation a été envoyé à {sentTo} (valable 24 heures). L&apos;adresse change seulement quand
          vous cliquez sur ce lien.
        </p>
      ) : (
        <>
          <FormErrors messages={errors} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="newEmail" className="font-semibold">
                Nouvelle adresse
              </label>
              <input id="newEmail" name="newEmail" type="email" autoComplete="email" className={inputClass} />
            </div>
            <div>
              <label htmlFor="emailPassword" className="font-semibold">
                Mot de passe actuel
              </label>
              <input
                id="emailPassword"
                name="emailPassword"
                type="password"
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
          </div>
          <button type="submit" disabled={pending} className={submitClass}>
            {pending ? "Envoi..." : "Changer d'adresse"}
          </button>
        </>
      )}
    </form>
  );
}

function PasswordForm() {
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    if (field(form, "newPassword") !== field(form, "confirmPassword")) {
      return setErrors(["Les deux nouveaux mots de passe ne sont pas identiques."]);
    }
    const parsed = passwordChangeSchema.safeParse({
      currentPassword: field(form, "currentPassword"),
      newPassword: field(form, "newPassword"),
    });
    if (!parsed.success) return setErrors(issues(parsed.error));
    setPending(true);
    setErrors([]);
    const result = await postJson("/me/password", parsed.data);
    setPending(false);
    if (!result.ok) return setErrors(result.error.messages);
    element.reset();
    setMessage("Mot de passe modifié. Vos autres appareils ont été déconnectés.");
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="titre-mdp" className={sectionClass}>
      <h2 id="titre-mdp" className={titleClass}>
        Mot de passe
      </h2>
      <FormErrors messages={errors} />
      <div>
        <label htmlFor="currentPassword" className="font-semibold">
          Mot de passe actuel
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className={inputClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="newPassword" className="font-semibold">
            Nouveau mot de passe
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            aria-describedby="mdp-regle"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="font-semibold">
            Confirmer le nouveau mot de passe
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={inputClass}
          />
        </div>
      </div>
      <p id="mdp-regle" className="text-sm text-asphalte/80">
        12 caractères minimum, avec au moins 3 types : minuscules, majuscules, chiffres, caractères spéciaux.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Enregistrement..." : "Changer le mot de passe"}
        </button>
        <p role="status" className="text-sm text-foret">
          {message}
        </p>
      </div>
    </form>
  );
}

function TwoFactor({ profile }: { profile: AccountProfileDto }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [setup, setSetup] = useState<TwoFactorSetupDto | null>(null);
  const [pending, setPending] = useState(false);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = twoFactorSetupSchema.safeParse({
      currentPassword: field(new FormData(event.currentTarget), "tfPassword"),
    });
    if (!parsed.success) return setErrors(issues(parsed.error));
    setPending(true);
    setErrors([]);
    const result = await postJson<TwoFactorSetupDto>("/me/2fa/setup", parsed.data);
    setPending(false);
    if (result.ok) setSetup(result.data);
    else setErrors(result.error.messages);
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = twoFactorEnableSchema.safeParse({
      code: field(new FormData(event.currentTarget), "tfCode").replace(/\s/g, ""),
    });
    if (!parsed.success) return setErrors(issues(parsed.error));
    setPending(true);
    setErrors([]);
    const result = await postJson("/me/2fa/enable", parsed.data);
    setPending(false);
    if (!result.ok) return setErrors(result.error.messages);
    setSetup(null);
    router.refresh();
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = twoFactorDisableSchema.safeParse({
      currentPassword: field(form, "tfPassword"),
      code: field(form, "tfCode").replace(/\s/g, ""),
    });
    if (!parsed.success) return setErrors(issues(parsed.error));
    setPending(true);
    setErrors([]);
    const result = await postJson("/me/2fa/disable", parsed.data);
    setPending(false);
    if (!result.ok) return setErrors(result.error.messages);
    router.refresh();
  }

  const codeInput = (
    <div>
      <label htmlFor="tfCode" className="font-semibold">
        Code à 6 chiffres de l&apos;application
      </label>
      <input
        id="tfCode"
        name="tfCode"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        className={`${inputClass} max-w-48 text-xl tracking-widest`}
      />
    </div>
  );
  const passwordInput = (
    <div>
      <label htmlFor="tfPassword" className="font-semibold">
        Mot de passe actuel
      </label>
      <input id="tfPassword" name="tfPassword" type="password" autoComplete="current-password" className={inputClass} />
    </div>
  );

  return (
    <section aria-labelledby="titre-2fa" className={sectionClass}>
      <h2 id="titre-2fa" className={titleClass}>
        Double authentification
      </h2>
      <FormErrors messages={errors} />
      {profile.twoFactorEnabled ? (
        <>
          <p>
            <strong>Active.</strong> Un code de votre application d&apos;authentification est demandé à chaque
            connexion.
          </p>
          {profile.role === "ADMIN" ? (
            <p className="text-sm text-asphalte/80">Elle est obligatoire pour un compte administrateur.</p>
          ) : (
            <form onSubmit={disable} noValidate className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {passwordInput}
                {codeInput}
              </div>
              <button
                type="submit"
                disabled={pending}
                className="min-h-11 border border-balise px-5 font-semibold text-balise"
              >
                Désactiver la double authentification
              </button>
            </form>
          )}
        </>
      ) : setup ? (
        <form onSubmit={confirm} noValidate className="space-y-3">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Ouvrez une application d&apos;authentification (Google Authenticator, Microsoft Authenticator, Aegis...).
            </li>
            <li>Scannez ce QR code, ou saisissez la clé à la main.</li>
            <li>Saisissez le code à 6 chiffres affiché par l&apos;application.</li>
          </ol>
          <div
            role="img"
            aria-label="QR code à scanner avec votre application d'authentification"
            className="w-48 border border-asphalte/15 bg-white p-2"
            dangerouslySetInnerHTML={{ __html: setup.qrSvg }}
          />
          <p className="text-sm">
            Clé : <code className="break-all bg-papier px-1">{setup.secret}</code>
          </p>
          {codeInput}
          <button type="submit" disabled={pending} className={submitClass}>
            {pending ? "Vérification..." : "Activer"}
          </button>
        </form>
      ) : (
        <form onSubmit={start} noValidate className="space-y-3">
          <p>
            Après votre mot de passe, un code à 6 chiffres affiché par votre téléphone vous sera demandé. C&apos;est la
            meilleure protection contre le vol de mot de passe.
          </p>
          {passwordInput}
          <button type="submit" disabled={pending} className={submitClass}>
            {pending ? "Préparation..." : "Activer la double authentification"}
          </button>
        </form>
      )}
    </section>
  );
}
