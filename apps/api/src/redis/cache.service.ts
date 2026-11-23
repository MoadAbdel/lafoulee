import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "@upstash/redis";
import { REDIS } from "./redis.constants.js";

/**
 * Cache des lectures fréquentes (dossier, C21 et C22 : écoconception).
 * Chaque espace de noms a une version : l'incrémenter invalide d'un coup
 * toutes ses entrées, sans parcourir les clés.
 * Si Redis est indisponible, on lit directement la source : le cache ne doit
 * jamais faire tomber le site.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async getOrSet<T>(namespace: string, key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    let fullKey: string | null = null;
    try {
      const version = (await this.redis.get<number>(`cache-version:${namespace}`)) ?? 0;
      fullKey = `cache:${namespace}:v${version}:${key}`;
      const hit = await this.redis.get<T>(fullKey);
      if (hit !== null) return hit;
    } catch (error) {
      this.logger.warn(`Lecture du cache impossible (${namespace}) : ${String(error)}`);
    }

    const value = await load();
    if (fullKey) {
      try {
        await this.redis.set(fullKey, value, { ex: ttlSeconds });
      } catch (error) {
        this.logger.warn(`Écriture du cache impossible (${namespace}) : ${String(error)}`);
      }
    }
    return value;
  }

  async invalidate(namespace: string): Promise<void> {
    await this.redis.incr(`cache-version:${namespace}`);
  }
}
