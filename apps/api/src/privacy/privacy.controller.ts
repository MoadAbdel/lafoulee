import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  consentSchema,
  deleteAccountSchema,
  newsletterSchema,
  privacyRequestSchema,
  tokenSchema,
  unsubscribeSchema,
  type ConsentInput,
  type PrivacyRequestInput,
} from "@lafoulee/shared";
import { clearSessionCookies } from "../auth/cookies.js";
import { clientIp, CurrentUser, Public, Roles, type AuthUser } from "../common/decorators.js";
import { ENV, type Env } from "../config/env.js";
import { RateLimitService } from "../redis/rate-limit.service.js";
import { PrivacyService } from "./privacy.service.js";

@Controller()
export class PrivacyController {
  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly privacy: PrivacyService,
    private readonly rateLimit: RateLimitService,
  ) {}

  /** Preuve du consentement aux cookies (C11). */
  @Public()
  @Post("consents")
  @HttpCode(204)
  async consent(@Body({ schema: consentSchema }) body: ConsentInput, @Req() req: Request): Promise<void> {
    await this.rateLimit.consume("consent", clientIp(req), 30, "1 m");
    await this.privacy.recordConsent(body);
  }

  /** Droit d'accès et de portabilité (EF11) : téléchargement immédiat, en JSON. */
  @Get("me/data")
  async myData(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader("content-disposition", 'attachment; filename="mes-donnees-la-foulee.json"');
    return this.privacy.exportForUser(user.id);
  }

  /** Droit à l'effacement (EF11) : anonymisation immédiate, mot de passe redemandé. */
  @Post("me/delete")
  @HttpCode(204)
  async deleteMe(
    @Body({ schema: deleteAccountSchema }) body: { password: string },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.rateLimit.consume("delete-account", clientIp(req), 5, "10 m");
    await this.privacy.deleteOwnAccount(user.id, body.password);
    clearSessionCookies(res, this.config.APP_ORIGIN.startsWith("https://"));
  }

  /** Demande d'un visiteur sans compte : réponse identique dans tous les cas. */
  @Public()
  @Post("privacy/requests")
  @HttpCode(202)
  async request(@Body({ schema: privacyRequestSchema }) body: PrivacyRequestInput, @Req() req: Request) {
    await this.rateLimit.consume("privacy-request", clientIp(req), 3, "10 m");
    await this.privacy.requestByEmail(body);
    return { status: "CONFIRMATION_SENT" };
  }

  @Public()
  @Post("privacy/requests/confirm")
  @HttpCode(200)
  async confirm(@Body({ schema: tokenSchema }) body: { token: string }) {
    return { status: "OPEN", type: await this.privacy.confirmRequest(body.token) };
  }

  @Public()
  @Post("newsletter")
  @HttpCode(202)
  async subscribe(@Body({ schema: newsletterSchema }) body: { email: string }, @Req() req: Request) {
    await this.rateLimit.consume("newsletter", clientIp(req), 5, "10 m");
    await this.privacy.subscribe(body.email);
    return { status: "CONFIRMATION_SENT" };
  }

  @Public()
  @Post("newsletter/confirm")
  @HttpCode(200)
  async confirmNewsletter(@Body({ schema: tokenSchema }) body: { token: string }) {
    await this.privacy.confirmSubscription(body.token);
    return { status: "CONFIRMED" };
  }

  @Public()
  @Post("newsletter/unsubscribe")
  @HttpCode(200)
  async unsubscribe(@Body({ schema: unsubscribeSchema }) body: { email: string; signature: string }) {
    await this.privacy.unsubscribe(body.email, body.signature);
    return { status: "UNSUBSCRIBED" };
  }

  /** Back-office : demandes RGPD à traiter sous un mois (EA06). */
  @Roles("ADMIN")
  @Get("admin/gdpr-requests")
  requests() {
    return this.privacy.listRequests();
  }

  @Roles("ADMIN")
  @Post("admin/gdpr-requests/:id/process")
  process(@Param("id", new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.privacy.processRequest({ actorId: user.id, ip: clientIp(req) }, id);
  }
}
