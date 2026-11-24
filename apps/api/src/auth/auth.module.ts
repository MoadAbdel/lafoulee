import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { OriginGuard } from "../common/origin.guard.js";
import { AccountController } from "./account.controller.js";
import { AccountService } from "./account.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard, RolesGuard } from "./guards.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { TotpService } from "./totp.service.js";

@Module({
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    AccountService,
    PasswordService,
    TokenService,
    TotpService,
    // Ordre d'exécution : origine, puis session, puis rôle.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PasswordService, TotpService, TokenService],
})
export class AuthModule {}
