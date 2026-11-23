/** Appels de l'API depuis le navigateur (même origine : les cookies suivent). */

export interface ApiFailure {
  status: number;
  code?: string;
  messages: string[];
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

function toMessages(message: unknown): string[] {
  if (Array.isArray(message)) {
    // Les erreurs de validation arrivent sous la forme "champ: message".
    return message.map((item) => String(item).replace(/^[a-zA-Z.]+: /, ""));
  }
  return [typeof message === "string" ? message : "Une erreur est survenue. Réessayez."];
}

export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers:
        body === undefined
          ? { accept: "application/json" }
          : { "content-type": "application/json", accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: { status: 0, messages: ["Connexion impossible. Vérifiez votre réseau."] } };
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, data: payload as T };
  const messages =
    res.status === 429 ? ["Trop de tentatives. Patientez une minute avant de réessayer."] : toMessages(payload.message);
  return { ok: false, error: { status: res.status, code: payload.code as string | undefined, messages } };
}

export function postJson<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
  return apiRequest<T>("POST", path, body);
}

export const getJson = <T>(path: string) => apiRequest<T>("GET", path);
export const putJson = <T>(path: string, body: unknown) => apiRequest<T>("PUT", path, body);
export const deleteJson = (path: string) => apiRequest<void>("DELETE", path);

/** Prévient les composants (compteur du panier) qu'un changement a eu lieu. */
export const CART_EVENT = "lafoulee:panier";
export function notifyCartChanged(): void {
  window.dispatchEvent(new Event(CART_EVENT));
}
