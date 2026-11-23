import { Global, Module } from "@nestjs/common";
import { Redis } from "@upstash/redis";
import { ENV, type Env } from "../config/env.js";
import { CacheService } from "./cache.service.js";
import { RateLimitService } from "./rate-limit.service.js";
import { REDIS } from "./redis.constants.js";

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      useFactory: (config: Env) =>
        new Redis({ url: config.UPSTASH_REDIS_REST_URL, token: config.UPSTASH_REDIS_REST_TOKEN }),
    },
    CacheService,
    RateLimitService,
  ],
  exports: [REDIS, CacheService, RateLimitService],
})
export class RedisModule {}
