import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Protection CSRF, en plus des cookies SameSite=Lax : une requête qui modifie
 * des données et qui vient d'un navigateur doit avoir une origine identique
 * à l'hôte appelé. Les appels serveur à serveur (Next.js via le binding
 * privé) n'envoient pas d'en-tête Origin et ne sont pas concernés.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    if (!origin) return true;

    const forwardedHost = req.headers["x-forwarded-host"];
    const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new ForbiddenException("Origine invalide.");
    }
    if (!host || originHost !== host) throw new ForbiddenException("Origine non autorisée.");
    return true;
  }
}
