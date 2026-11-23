import { Injectable } from "@nestjs/common";

export interface HealthReport {
  status: "ok";
  service: "api";
  version: string;
  time: string;
}

@Injectable()
export class HealthService {
  report(): HealthReport {
    return {
      status: "ok",
      service: "api",
      // Fourni par Vercel au déploiement, "local" sinon.
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      time: new Date().toISOString(),
    };
  }
}
