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

/** Adresse IP du client (Vercel renseigne x-forwarded-for). */
export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "inconnue";
}
