import { Controller, Get } from "@nestjs/common";
import { HealthService, type HealthReport } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Sonde de disponibilité : GET /api/v1/health */
  @Get()
  check(): HealthReport {
    return this.health.report();
  }
}
