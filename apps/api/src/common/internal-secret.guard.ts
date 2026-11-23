import { Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { ENV, type Env } from "../config/env.js";

/**
 * Routes internes (tâche planifiée Vercel Cron, consommateur de file) :
 * en-tête "Authorization: Bearer <CRON_SECRET>", comparé en temps constant.
 */
@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly config: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const header = context.switchToHttp().getRequest<Request>().headers.authorization ?? "";
    const expected = Buffer.from(`Bearer ${this.config.CRON_SECRET}`);
    const given = Buffer.from(header);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new UnauthorizedException("Accès interne refusé.");
    }
    return true;
  }
}
