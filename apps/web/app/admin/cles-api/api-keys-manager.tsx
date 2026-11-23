"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { API_SCOPES, apiKeyCreateSchema, type ApiKeyDto, type CreatedApiKeyDto } from "@lafoulee/shared";
import { FormErrors, inputClass } from "@/components/form-errors";
import { apiRequest } from "@/lib/client-api";

const SCOPE_LABELS = { "catalog:read": "Lire le catalogue", "stock:read": "Lire les boutiques et stocks" } as const;

/** Création (clé montrée une seule fois) et révocation immédiate des clés (EA07). */
export function ApiKeysManager({ keys }: { keys: ApiKeyDto[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [created, setCreated] = useState<CreatedApiKeyDto | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = apiKeyCreateSchema.safeParse({
      name: String(form.get("name")),
      scopes: form.getAll("scopes").map(String),
    });
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((issue) => (issue.path[0] === "scopes" ? "Cochez au moins un droit." : issue.message)),
      );
      return;
    }
    setErrors([]);
    const result = await apiRequest<CreatedApiKeyDto>("POST", "/admin/api-keys", parsed.data);
    if (result.ok) {
      setCreated(result.data);
      event.currentTarget?.reset();
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  async function revoke(key: ApiKeyDto) {
    if (!window.confirm(`Révoquer la clé "${key.name}" ? Le partenaire perdra l'accès immédiatement.`)) return;
    const result = await apiRequest("DELETE", `/admin/api-keys/${key.id}`);
    if (result.ok) router.refresh();
    else setErrors(result.error.messages);
  }

  return (
    <div className="mt-6 space-y-6">
      <FormErrors messages={errors} />
      {created && (
        <div role="status" className="border-l-4 border-foret bg-white p-4">
          <p className="font-semibold">
            Clé créée pour {created.name}. Copiez-la maintenant : elle ne sera plus affichée.
          </p>
          <code className="mt-2 block break-all bg-craie p-2 text-sm">{created.key}</code>
        </div>
      )}

      <form onSubmit={create} noValidate className="space-y-3 border border-asphalte/15 bg-white p-4">
        <h2 className="font-display text-2xl font-bold uppercase">Nouvelle clé</h2>
        <div>
          <label htmlFor="key-name" className="font-semibold">
            Partenaire
          </label>
          <input id="key-name" name="name" maxLength={60} className={inputClass} />
        </div>
        <fieldset>
          <legend className="font-semibold">Droits</legend>
          {API_SCOPES.map((scope) => (
            <label key={scope} className="mt-1 flex min-h-11 items-center gap-2">
              <input type="checkbox" name="scopes" value={scope} defaultChecked={scope === "catalog:read"} />
              {SCOPE_LABELS[scope]} <code className="text-xs text-asphalte/70">{scope}</code>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="min-h-11 bg-balise px-5 font-semibold text-craie">
          Créer la clé
        </button>
      </form>

      <table className="w-full border border-asphalte/15 bg-white text-left text-sm">
        <caption className="sr-only">Clés existantes</caption>
        <thead className="bg-craie">
          <tr>
            <th scope="col" className="p-2">
              Partenaire
            </th>
            <th scope="col" className="p-2">
              Préfixe
            </th>
            <th scope="col" className="p-2">
              Droits
            </th>
            <th scope="col" className="p-2">
              Dernière utilisation
            </th>
            <th scope="col" className="p-2">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.id} className="border-t border-asphalte/10">
              <td className="p-2">{key.name}</td>
              <td className="p-2">
                <code>{key.prefix}</code>
              </td>
              <td className="p-2">{key.scopes.join(", ")}</td>
              <td className="p-2">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString("fr-FR") : "Jamais"}</td>
              <td className="p-2">
                {key.revokedAt ? (
                  <span className="text-asphalte/70">Révoquée</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void revoke(key)}
                    aria-label={`Révoquer la clé ${key.name}`}
                    className="min-h-11 text-balise underline underline-offset-4"
                  >
                    Révoquer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
