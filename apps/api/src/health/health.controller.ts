import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../common/decorators.js";
import { HealthService, type HealthReport } from "./health.service.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Sonde : GET /api/v1/health. 200 si la base et Redis répondent, 503 sinon (TB31). */
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const report = await this.health.report();
    res.status(report.status === "ok" ? 200 : 503);
    return report;
  }
}
