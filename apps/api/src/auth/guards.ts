import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@lafoulee/shared";
import { IS_PUBLIC, ROLES, type AuthenticatedRequest } from "../common/decorators.js";
import { ACCESS_COOKIE } from "./cookies.js";
import { TokenService } from "./token.service.js";

/**
 * Garde globale : toute route exige une session valide, sauf si elle est
 * marquée @Public(). Oublier un décorateur ferme la route au lieu de l'ouvrir.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const token = cookies?.[ACCESS_COOKIE];

    // Route publique : la session est lue si elle existe (ex. commande d'un client
    // connecté), mais n'est jamais exigée. Un jeton invalide est simplement ignoré.
    if (isPublic) {
      // Pas de condition sur la présence du cookie : la vérification du jeton décide seule.
      const claims = await this.tokens.verifyAccess(token ?? "").catch(() => null);
      if (claims) req.user = { id: claims.sub, role: claims.role };
      return true;
    }

    if (!token) throw new UnauthorizedException("Connexion requise.");
    try {
      const claims = await this.tokens.verifyAccess(token);
      req.user = { id: claims.sub, role: claims.role };
      return true;
    } catch {
      throw new UnauthorizedException("Session expirée.");
    }
  }
}

/** Vérifie le rôle demandé par @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException("Accès refusé.");
    return true;
  }
}
