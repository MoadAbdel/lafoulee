import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "@upstash/redis";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.constants.js";

export interface HealthReport {
  status: "ok" | "degraded";
  service: "api";
  version: string;
  time: string;
  checks: { database: boolean; redis: boolean };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async report(): Promise<HealthReport> {
    const [database, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis
        .ping()
        .then((answer) => answer === "PONG")
        .catch(() => false),
    ]);
    return {
      status: database && redis ? "ok" : "degraded",
      service: "api",
      // Fourni par Vercel au déploiement, "local" sinon.
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      time: new Date().toISOString(),
      checks: { database, redis },
    };
  }
}
