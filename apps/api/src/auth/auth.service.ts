import { ForbiddenException, Inject, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { LoginInput, LoginResult, RegisterInput, SessionUser } from "@lafoulee/shared";
import { ENV, type Env } from "../config/env.js";
import { randomToken, sha256 } from "../common/crypto.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { MailService } from "../mail/mail.service.js";
import type { User } from "../generated/prisma/client.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";
import { TotpService } from "./totp.service.js";
import { REFRESH_TTL_SECONDS } from "./cookies.js";

const VERIFY_EMAIL_TTL_MS = 24 * 3600 * 1000;

export interface IssuedSession {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
}

export function toSessionUser(user: Pick<User, "id" | "email" | "firstName" | "role">): SessionUser {
  return { id: user.id, email: user.email, firstName: user.firstName, role: user.role };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
    private readonly mail: MailService,
  ) {}

  /**
   * Inscription (EF08, double opt-in). La réponse est la même que l'email soit
   * nouveau ou déjà utilisé : on ne révèle pas quels comptes existent.
   */
  async register(input: RegisterInput): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      if (!existing.emailVerifiedAt && !existing.anonymizedAt) await this.sendVerification(existing);
      else this.logger.log("Inscription demandée pour un email déjà vérifié : aucune action.");
      return;
    }
    const user = await this.prisma.user.create({
      data: { email: input.email, firstName: input.firstName, passwordHash: await this.passwords.hash(input.password) },
    });
    await this.sendVerification(user);
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt && !user.anonymizedAt) await this.sendVerification(user);
  }

  private async sendVerification(user: User): Promise<void> {
    const token = randomToken();
    await this.prisma.emailToken.create({
      data: {
        userId: user.id,
        email: user.email,
        purpose: "VERIFY_EMAIL",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + VERIFY_EMAIL_TTL_MS),
      },
    });
    const link = `${this.config.APP_ORIGIN}/verifier-email?token=${token}`;
    // Un échec d'envoi ne doit pas faire échouer l'inscription : le compte existe,
    // l'erreur est journalisée et la personne peut redemander le lien.
    try {
      await this.mail.send({
        to: user.email,
        subject: "Confirmez votre adresse email",
        text: `Bonjour,\n\nPour activer votre compte La Foulée, ouvrez ce lien (valable 24 heures) :\n${link}\n\nSi vous n'avez pas créé de compte, ignorez ce message.`,
        html: `<p>Bonjour,</p><p>Pour activer votre compte La Foulée, cliquez sur ce lien (valable 24 heures) :</p><p><a href="${link}">Confirmer mon adresse email</a></p><p>Si vous n'avez pas créé de compte, ignorez ce message.</p>`,
      });
    } catch (error) {
      this.logger.error(`Email de vérification non envoyé (utilisateur ${user.id}) : ${String(error)}`);
    }
  }

  /** Lien de confirmation : à usage unique, expire après 24 h. */
  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (
      !record ||
      record.purpose !== "VERIFY_EMAIL" ||
      record.usedAt ||
      record.expiresAt < new Date() ||
      !record.userId
    ) {
      throw new ForbiddenException("Ce lien est invalide ou a expiré.");
    }
    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    ]);
  }

  /**
   * Étape 1 de la connexion. Un compte avec double authentification (obligatoire pour
   * un administrateur, facultative pour un client) doit ensuite fournir son code TOTP.
   */
  async login(input: LoginInput): Promise<{ result: LoginResult; session?: IssuedSession }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const passwordOk = await this.passwords.verify(user?.passwordHash ?? null, input.password);
    if (!user || !passwordOk || user.anonymizedAt) {
      throw new UnauthorizedException("Email ou mot de passe incorrect.");
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "EMAIL_NOT_VERIFIED",
        message: "Confirmez d'abord votre adresse email.",
      });
    }
    if (user.role === "ADMIN" && !user.totpSecretEnc) {
      throw new ForbiddenException({
        statusCode: 403,
        code: "TOTP_NOT_ENROLLED",
        message: "Double authentification non configurée.",
      });
    }
    if (user.totpSecretEnc) {
      return { result: { status: "TOTP_REQUIRED", challenge: await this.tokens.signTotpChallenge(user.id) } };
    }
    const session = await this.issueSession(user);
    return { result: { status: "OK", user: session.user }, session };
  }

  /** Étape 2 : défi signé + code TOTP. La connexion d'un administrateur est journalisée. */
  async loginTotp(challenge: string, code: string, ip: string): Promise<IssuedSession> {
    let userId: string;
    try {
      userId = await this.tokens.verifyTotpChallenge(challenge);
    } catch {
      throw new UnauthorizedException("Session de connexion expirée. Recommencez.");
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecretEnc || user.anonymizedAt || !(await this.totp.check(user.id, user.totpSecretEnc, code))) {
      throw new UnauthorizedException("Code incorrect.");
    }
    if (user.role === "ADMIN") {
      await this.prisma.auditLog.create({
        data: { actorId: user.id, action: "admin.login", entity: "user", entityId: user.id, ip },
      });
    }
    return this.issueSession(user);
  }

  /**
   * Rotation du jeton de rafraîchissement. Un jeton déjà utilisé (rejoué)
   * révoque toute sa famille : la session volée et la session légitime sont fermées.
   */
  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    if (!rawToken) throw new UnauthorizedException("Session absente.");
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { user: true },
    });
    if (!record) throw new UnauthorizedException("Session invalide.");
    if (record.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Réutilisation d'un jeton de rafraîchissement : famille ${record.familyId} révoquée.`);
      throw new UnauthorizedException("Session invalide.");
    }
    if (record.expiresAt < new Date() || record.user.anonymizedAt) throw new UnauthorizedException("Session expirée.");

    // Révocation conditionnelle : si deux requêtes arrivent en même temps, une seule gagne.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new UnauthorizedException("Session invalide.");
    return this.issueSession(record.user, record.familyId);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (record) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.anonymizedAt) throw new UnauthorizedException("Session invalide.");
    return toSessionUser(user);
  }

  /** Session neuve (par exemple après un changement de mot de passe). */
  startSession(user: User): Promise<IssuedSession> {
    return this.issueSession(user);
  }

  private async issueSession(user: User, familyId: string = randomUUID()): Promise<IssuedSession> {
    const refreshToken = randomToken();
    await this.prisma.$transaction([
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          familyId,
          tokenHash: sha256(refreshToken),
          expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    ]);
    const accessToken = await this.tokens.signAccess({ sub: user.id, role: user.role });
    return { user: toSessionUser(user), accessToken, refreshToken };
  }
}
