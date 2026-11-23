import type { Redis } from "@upstash/redis";
import { RateLimitService, weightedCount } from "./rate-limit.service.js";

/** Redis en mémoire, limité aux commandes utilisées par le limiteur. */
function fakeRedis(): Redis {
  const store = new Map<string, number>();
  return {
    pipeline() {
      const ops: (() => unknown)[] = [];
      const chain = {
        incr(key: string) {
          ops.push(() => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return next;
          });
          return chain;
        },
        expire() {
          ops.push(() => 1);
          return chain;
        },
        get(key: string) {
          ops.push(() => store.get(key) ?? null);
          return chain;
        },
        exec: () => Promise.resolve(ops.map((op) => op())),
      };
      return chain;
    },
  } as unknown as Redis;
}

describe("RateLimitService", () => {
  it("weightedCount pondère la fenêtre précédente", () => {
    expect(weightedCount(10, 2, 0.25)).toBe(9.5);
    expect(weightedCount(10, 2, 1)).toBe(2);
  });

  it("TB33a accepte jusqu'à la limite puis renvoie 429 avec un délai", async () => {
    const limiter = new RateLimitService(fakeRedis());
    const now = Date.UTC(2026, 0, 5, 10, 0, 0);
    for (let i = 0; i < 3; i++) await limiter.consume("test", "ip-1", 3, "1 m", now);
    await expect(limiter.consume("test", "ip-1", 3, "1 m", now)).rejects.toMatchObject({
      status: 429,
      response: { retryAfter: 60 },
    });
  });

  it("compte chaque identifiant séparément", async () => {
    const limiter = new RateLimitService(fakeRedis());
    const now = Date.UTC(2026, 0, 5, 10, 0, 0);
    await limiter.consume("test", "a", 1, "1 m", now);
    await expect(limiter.consume("test", "b", 1, "1 m", now)).resolves.toBeUndefined();
  });

  it("la fenêtre glisse : les anciennes tentatives pèsent de moins en moins", async () => {
    const limiter = new RateLimitService(fakeRedis());
    const start = Date.UTC(2026, 0, 5, 10, 0, 0);
    for (let i = 0; i < 4; i++) await limiter.consume("test", "ip", 4, "1 m", start);
    // 30 s après la fin de la première fenêtre, son poids n'est plus que de 50 % : 4 x 0,5 + 1 = 3.
    await expect(limiter.consume("test", "ip", 4, "1 m", start + 90_000)).resolves.toBeUndefined();
  });
});
