import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  tokenSchema,
  totpLoginSchema,
  type LoginInput,
  type LoginResult,
  type RegisterInput,
  type SessionUser,
  type TotpLoginInput,
} from "@lafoulee/shared";
import { ENV, type Env } from "../config/env.js";
import { clientIp, CurrentUser, Public, type AuthUser } from "../common/decorators.js";
import { RateLimitService } from "../redis/rate-limit.service.js";
import { AuthService } from "./auth.service.js";
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from "./cookies.js";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly auth: AuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  private get secureCookies(): boolean {
    return this.config.APP_ORIGIN.startsWith("https://");
  }

  @Public()
  @Post("register")
  @HttpCode(202)
  async register(@Body({ schema: registerSchema }) body: RegisterInput, @Req() req: Request) {
    await this.rateLimit.consume("register", clientIp(req), 5, "10 m");
    await this.rateLimit.consume("register-email", body.email, 3, "1 h");
    await this.auth.register(body);
    return { status: "VERIFICATION_SENT" };
  }

  @Public()
  @Post("resend-verification")
  @HttpCode(202)
  async resend(@Body({ schema: resendVerificationSchema }) body: { email: string }, @Req() req: Request) {
    await this.rateLimit.consume("resend", clientIp(req), 3, "10 m");
    await this.rateLimit.consume("resend-email", body.email, 3, "1 h");
    await this.auth.resendVerification(body.email);
    return { status: "VERIFICATION_SENT" };
  }

  @Public()
  @Post("verify-email")
  @HttpCode(200)
  async verifyEmail(@Body({ schema: tokenSchema }) body: { token: string }) {
    await this.auth.verifyEmail(body.token);
    return { status: "VERIFIED" };
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    await this.rateLimit.consume("login-ip", clientIp(req), 10, "1 m");
    await this.rateLimit.consume("login-email", body.email, 10, "15 m");
    const { result, session } = await this.auth.login(body);
    if (session) setSessionCookies(res, session.accessToken, session.refreshToken, this.secureCookies);
    return result;
  }

  @Public()
  @Post("login/totp")
  @HttpCode(200)
  async loginTotp(
    @Body({ schema: totpLoginSchema }) body: TotpLoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResult> {
    await this.rateLimit.consume("login-totp", clientIp(req), 5, "1 m");
    const session = await this.auth.loginTotp(body.challenge, body.code, clientIp(req));
    setSessionCookies(res, session.accessToken, session.refreshToken, this.secureCookies);
    return { status: "OK", user: session.user };
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ user: SessionUser }> {
    try {
      const session = await this.auth.refresh(readCookie(req, REFRESH_COOKIE));
      setSessionCookies(res, session.accessToken, session.refreshToken, this.secureCookies);
      return { user: session.user };
    } catch (error) {
      clearSessionCookies(res, this.secureCookies);
      throw error;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_COOKIE));
    clearSessionCookies(res, this.secureCookies);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser): Promise<SessionUser> {
    return this.auth.me(user.id);
  }

  /**
   * État de la session pour l'en-tête du site : toujours 200, user null pour un
   * visiteur. Évite une erreur 401 dans la console à chaque page (bonnes pratiques).
   */
  @Public()
  @Get("session")
  async session(@CurrentUser() user: AuthUser | undefined): Promise<{ user: SessionUser | null }> {
    return { user: user ? await this.auth.me(user.id) : null };
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[name];
}
