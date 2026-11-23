import { Inject, Injectable, Logger } from "@nestjs/common";
import { ENV, type Env } from "../config/env.js";
import { CacheService } from "../redis/cache.service.js";
import { CATALOG_CACHE } from "./catalog.service.js";

/**
 * Après une modification du catalogue (prix, statut, stock), on invalide :
 * 1. le cache Redis de l'API ;
 * 2. le cache des pages du site (étiquette "catalog" des Cache Components),
 *    par une route interne du site protégée par le secret interne.
 * Un échec du point 2 est journalisé : les pages se mettent de toute façon à jour en quelques minutes.
 */
@Injectable()
export class CatalogInvalidationService {
  private readonly logger = new Logger(CatalogInvalidationService.name);

  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly cache: CacheService,
  ) {}

  async catalogChanged(): Promise<void> {
    await this.cache.invalidate(CATALOG_CACHE);
    if (!process.env.VERCEL) return; // en local et en CI, pas de cache de pages partagé
    try {
      const res = await fetch(new URL("/api/revalidate", this.config.APP_ORIGIN), {
        method: "POST",
        headers: { authorization: `Bearer ${this.config.CRON_SECRET}` },
      });
      if (!res.ok) this.logger.warn(`Invalidation du cache du site refusée : HTTP ${res.status}`);
    } catch (error) {
      this.logger.warn(`Invalidation du cache du site impossible : ${String(error)}`);
    }
  }
}
