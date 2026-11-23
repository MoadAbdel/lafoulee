import { HttpException, HttpStatus, Inject, Injectable } from "@nestjs/common";
import type { Redis } from "@upstash/redis";
import { REDIS } from "./redis.constants.js";
import { redisKey } from "./redis-key.js";

const UNITS = { s: 1, m: 60, h: 3600 } as const;
type Duration = `${number} ${keyof typeof UNITS}`;

function toSeconds(window: Duration): number {
  const [amount, unit] = window.split(" ") as [string, keyof typeof UNITS];
  return Number(amount) * UNITS[unit];
}

/**
 * Pondère le compteur de la fenêtre précédente selon la part de cette fenêtre
 * qui recouvre encore la fenêtre glissante (algorithme "sliding window counter").
 */
export function weightedCount(previous: number, current: number, elapsedRatio: number): number {
  return previous * (1 - elapsedRatio) + current;
}

/**
 * Limitation de débit applicative (dossier, C24), à fenêtre glissante approximée :
 * deux compteurs Redis (fenêtre courante et précédente) avec expiration.
 * Uniquement des commandes simples (INCR, EXPIRE, GET) : fonctionne avec Upstash,
 * un Redis local et la CI, et ne dépend pas de l'offre Vercel.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Lève une erreur 429 avec le délai d'attente si la limite est dépassée. */
  async consume(name: string, identifier: string, limit: number, window: Duration, now = Date.now()): Promise<void> {
    const size = toSeconds(window);
    const nowSeconds = now / 1000;
    const index = Math.floor(nowSeconds / size);
    const elapsedRatio = (nowSeconds - index * size) / size;
    const base = redisKey("ratelimit", name, identifier);

    const pipeline = this.redis.pipeline();
    pipeline.incr(`${base}:${index}`);
    pipeline.expire(`${base}:${index}`, size * 2);
    pipeline.get<number>(`${base}:${index - 1}`);
    const [current, , previous] = await pipeline.exec<[number, number, number | null]>();

    if (weightedCount(previous ?? 0, current, elapsedRatio) > limit) {
      const retryAfter = Math.max(1, Math.ceil(size * (1 - elapsedRatio)));
      throw new HttpException(
        { statusCode: 429, message: "Trop de tentatives. Réessayez plus tard.", retryAfter },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
