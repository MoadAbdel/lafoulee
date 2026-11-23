import { cookies } from "next/headers";
import { apiUrl } from "./api";

export class AdminAccessError extends Error {}

/**
 * Lecture du back-office côté serveur, avec le cookie de session de l'admin.
 * L'API revérifie le rôle ADMIN à chaque appel : ce fichier ne fait que transmettre.
 */
export async function adminGet<T>(path: string): Promise<T> {
  const access = (await cookies()).get("lf_at")?.value;
  if (!access) throw new AdminAccessError("Session absente");
  const res = await fetch(apiUrl(`/admin${path}`), { headers: { cookie: `lf_at=${access}` }, cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new AdminAccessError(`HTTP ${res.status}`);
  if (!res.ok) throw new Error(`API admin ${path} : HTTP ${res.status}`);
  return (await res.json()) as T;
}
