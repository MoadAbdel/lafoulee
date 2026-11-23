import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PrivacyController } from "./privacy.controller.js";
import { PrivacyService } from "./privacy.service.js";

/** RGPD : consentement, droits des personnes, newsletter, durées de conservation. */
@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
