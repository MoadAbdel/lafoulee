import {
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { ApiScope } from "@lafoulee/shared";
import { RateLimitService } from "../redis/rate-limit.service.js";
import { ApiKeysService } from "./api-keys.service.js";

export const REQUIRED_SCOPE = "requiredScope";
/** Droit exigé par une route de l'API partenaires. */
export const RequireScope = (scope: ApiScope) => SetMetadata(REQUIRED_SCOPE, scope);

/**
 * API partenaires : clé dans "Authorization: Bearer lf_live_...", droit (scope)
 * vérifié, puis limite de 60 requêtes par minute et par clé (429 au-delà).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly keys: ApiKeysService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization ?? "";
    const raw = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const key = raw ? await this.keys.authenticate(raw) : null;
    if (!key) throw new UnauthorizedException("Clé API absente, invalide ou révoquée.");

    const scope = this.reflector.getAllAndOverride<ApiScope | undefined>(REQUIRED_SCOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (scope && !key.scopes.includes(scope)) throw new ForbiddenException(`Droit "${scope}" requis.`);

    await this.rateLimit.consume("partner", key.id, 60, "1 m");
    return true;
  }
}
