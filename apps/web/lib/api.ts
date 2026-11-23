/**
 * URL de l'API pour les appels faits côté serveur.
 * - Sur Vercel : API_INTERNAL_URL est injectée par le binding du service "api" (appel privé).
 * - En local : API_DEV_URL (ex. http://localhost:4000).
 */
export function apiUrl(path: string): string {
  const base = process.env.API_INTERNAL_URL ?? process.env.API_DEV_URL ?? "http://localhost:4000";
  return new URL(`/api/v1${path}`, base).toString();
}
