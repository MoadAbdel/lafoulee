/**
 * URL de l'API pour les appels faits côté serveur.
 * - Sur Vercel : API_INTERNAL_URL est injectée par le binding du service "api" (appel privé).
 * - En local : API_DEV_URL (ex. http://localhost:4000).
 */
export function apiUrl(path: string): string {
  const base = process.env.API_INTERNAL_URL ?? process.env.API_DEV_URL ?? "http://localhost:4000";
  return new URL(`/api/v1${path}`, base).toString();
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** GET JSON côté serveur. Renvoie null sur 404, lève ApiError sur les autres erreurs. */
export async function getJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(apiUrl(path), { ...init, headers: { accept: "application/json", ...init?.headers } });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, `API ${path} : HTTP ${res.status}`);
  return (await res.json()) as T;
}
