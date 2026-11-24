import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { UserRole } from "@lafoulee/shared";

export const IS_PUBLIC = "isPublic";
export const ROLES = "roles";

/** Route accessible sans session. Toutes les autres routes exigent une session (garde globale). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Rôles autorisés sur une route (vérifiés par RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

export interface AuthUser {
  id: string;
  role: UserRole;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

/** Utilisateur de la session courante, posé par JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
  return ctx.switchToHttp().getRequest<AuthenticatedRequest>().user;
});

/**
 * Adresse IP du client, pour les limites de débit. On lit les en-têtes que Vercel écrit
 * lui-même (le client ne peut pas les imposer), jamais le premier élément de X-Forwarded-For,
 * qu'un client peut remplir à sa guise. En local et en CI : l'adresse de la connexion.
 */
export function clientIp(req: Request): string {
  const header = (name: string) => {
    const value = req.headers[name];
    return (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim();
  };
  if (process.env.VERCEL) {
    const ip = header("x-vercel-forwarded-for") || header("x-real-ip");
    if (ip) return ip;
  }
  return req.socket.remoteAddress || "inconnue";
}
