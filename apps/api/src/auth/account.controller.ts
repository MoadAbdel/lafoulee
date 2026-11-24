import { Body, Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  emailChangeSchema,
  forgotPasswordSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  resetPasswordSchema,
  tokenSchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
  twoFactorSetupSchema,
  type AccountProfileDto,
  type EmailChangeInput,
  type PasswordChangeInput,
  type ProfileUpdateInput,
  type ResetPasswordInput,
  type TwoFactorSetupDto,
} from "@lafoulee/shared";
import { ENV, type Env } from "../config/env.js";
import { clientIp, CurrentUser, Public, type AuthUser } from "../common/decorators.js";
import { RateLimitService } from "../redis/rate-limit.service.js";
import { AccountService } from "./account.service.js";
import { setSessionCookies } from "./cookies.js";

/** Sécurité du compte : profil, mot de passe, email, double authentification. */
@Controller()
export class AccountController {
  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly account: AccountService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get("me/profile")
  profile(@CurrentUser() user: AuthUser): Promise<AccountProfileDto> {
    return this.account.profile(user.id);
  }

  @Patch("me/profile")
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body({ schema: profileUpdateSchema }) body: ProfileUpdateInput,
  ): Promise<AccountProfileDto> {
    return this.account.updateProfile(user.id, body);
  }

  @Post("me/password")
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body({ schema: passwordChangeSchema }) body: PasswordChangeInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.rateLimit.consume("account-password", user.id, 5, "15 m");
    await this.account.changePassword(user.id, body);
    const session = await this.account.freshSession(user.id);
    setSessionCookies(res, session.accessToken, session.refreshToken, this.config.APP_ORIGIN.startsWith("https://"));
  }

  @Post("me/email")
  @HttpCode(202)
  async requestEmailChange(
    @CurrentUser() user: AuthUser,
    @Body({ schema: emailChangeSchema }) body: EmailChangeInput,
  ): Promise<{ status: "CONFIRMATION_SENT" }> {
    await this.rateLimit.consume("account-email", user.id, 3, "15 m");
    await this.account.requestEmailChange(user.id, body);
    return { status: "CONFIRMATION_SENT" };
  }

  @Public()
  @Post("auth/email-change/confirm")
  @HttpCode(200)
  async confirmEmailChange(@Body({ schema: tokenSchema }) body: { token: string }): Promise<{ status: "CONFIRMED" }> {
    await this.account.confirmEmailChange(body.token);
    return { status: "CONFIRMED" };
  }

  @Public()
  @Post("auth/password/forgot")
  @HttpCode(202)
  async forgotPassword(
    @Body({ schema: forgotPasswordSchema }) body: { email: string },
    @Req() req: Request,
  ): Promise<{ status: "EMAIL_SENT_IF_ACCOUNT" }> {
    await this.rateLimit.consume("forgot-ip", clientIp(req), 5, "15 m");
    await this.rateLimit.consume("forgot-email", body.email, 3, "1 h");
    await this.account.forgotPassword(body.email);
    return { status: "EMAIL_SENT_IF_ACCOUNT" };
  }

  @Public()
  @Post("auth/password/reset")
  @HttpCode(204)
  async resetPassword(
    @Body({ schema: resetPasswordSchema }) body: ResetPasswordInput,
    @Req() req: Request,
  ): Promise<void> {
    await this.rateLimit.consume("reset-ip", clientIp(req), 10, "15 m");
    await this.account.resetPassword(body);
  }

  @Post("me/2fa/setup")
  async startTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body({ schema: twoFactorSetupSchema }) body: { currentPassword: string },
  ): Promise<TwoFactorSetupDto> {
    await this.rateLimit.consume("account-2fa", user.id, 10, "15 m");
    return this.account.startTwoFactor(user.id, body.currentPassword);
  }

  @Post("me/2fa/enable")
  async enableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body({ schema: twoFactorEnableSchema }) body: { code: string },
  ): Promise<AccountProfileDto> {
    await this.rateLimit.consume("account-2fa", user.id, 10, "15 m");
    return this.account.enableTwoFactor(user.id, body.code);
  }

  @Post("me/2fa/disable")
  async disableTwoFactor(
    @CurrentUser() user: AuthUser,
    @Body({ schema: twoFactorDisableSchema }) body: { currentPassword: string; code: string },
  ): Promise<AccountProfileDto> {
    await this.rateLimit.consume("account-2fa", user.id, 10, "15 m");
    return this.account.disableTwoFactor(user.id, body.currentPassword, body.code);
  }
}
