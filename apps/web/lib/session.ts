import { cookies } from "next/headers";
import type { AccountProfileDto, OrderDto, SessionUser } from "@lafoulee/shared";
import { apiUrl } from "./api";

export type SessionState =
  { status: "authenticated"; user: SessionUser } | { status: "expired" } | { status: "anonymous" };

/**
 * Lit la session courante côté serveur en transmettant le cookie d'accès à l'API.
 * "expired" : le jeton d'accès (15 min) a expiré mais un jeton de rafraîchissement
 * existe peut-être ; le navigateur doit alors appeler /auth/refresh.
 */
export async function getSession(): Promise<SessionState> {
  const jar = await cookies();
  const access = jar.get("lf_at")?.value;
  if (!access) return { status: jar.has("lf_rt") ? "expired" : "anonymous" };

  const res = await fetch(apiUrl("/auth/me"), { headers: { cookie: `lf_at=${access}` }, cache: "no-store" });
  if (res.ok) return { status: "authenticated", user: (await res.json()) as SessionUser };
  return { status: "expired" };
}

/** Commandes du client connecté (EF09), lues avec son cookie d'accès. */
export async function getMyOrders(): Promise<OrderDto[]> {
  const access = (await cookies()).get("lf_at")?.value;
  if (!access) return [];
  const res = await fetch(apiUrl("/me/orders"), { headers: { cookie: `lf_at=${access}` }, cache: "no-store" });
  return res.ok ? ((await res.json()) as OrderDto[]) : [];
}

/** Informations du compte connecté (page "Mon compte"). */
export async function getAccountProfile(): Promise<AccountProfileDto | null> {
  const access = (await cookies()).get("lf_at")?.value;
  if (!access) return null;
  const res = await fetch(apiUrl("/me/profile"), { headers: { cookie: `lf_at=${access}` }, cache: "no-store" });
  return res.ok ? ((await res.json()) as AccountProfileDto) : null;
}
