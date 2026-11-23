import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller.js";
import { HealthService } from "./health.service.js";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it("TB31a renvoie un statut ok avec la version et l'heure", () => {
    const report = controller.check();
    expect(report.status).toBe("ok");
    expect(report.service).toBe("api");
    expect(report.version).toBeTypeOf("string");
    expect(Number.isNaN(Date.parse(report.time))).toBe(false);
  });
});
