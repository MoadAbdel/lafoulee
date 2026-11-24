import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import QRCode from "qrcode";
import type {
  AccountProfileDto,
  EmailChangeInput,
  PasswordChangeInput,
  ProfileUpdateInput,
  ResetPasswordInput,
  TwoFactorSetupDto,
} from "@lafoulee/shared";
import { ENV, type Env } from "../config/env.js";
import { randomToken, sha256 } from "../common/crypto.js";
import type { EmailTokenPurpose, User } from "../generated/prisma/client.js";
import { MailService } from "../mail/mail.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthService, type IssuedSession } from "./auth.service.js";
import { PasswordService } from "./password.service.js";
import { TotpService } from "./totp.service.js";

const RESET_TTL_MS = 3600 * 1000; // 1 heure
const EMAIL_CHANGE_TTL_MS = 24 * 3600 * 1000;

/**
 * Sécurité du compte (EF09) : profil, changement de mot de passe et d'email,
 * mot de passe oublié, double authentification facultative pour les clients.
 * Toute action sensible redemande le mot de passe actuel (ou un lien reçu par email),
 * et un changement de mot de passe ferme les sessions ouvertes ailleurs.
 */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly totp: TotpService,
    private readonly mail: MailService,
    private readonly auth: AuthService,
  ) {}

  private async activeUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.anonymizedAt) throw new UnauthorizedException("Session invalide.");
    return user;
  }

  private async requirePassword(user: User, password: string): Promise<void> {
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new ForbiddenException("Mot de passe actuel incorrect.");
    }
  }

  /** Envoi best effort : un échec est journalisé, l'action elle-même reste valable. */
  private async notify(to: string, subject: string, lines: string[]): Promise<void> {
    try {
      await this.mail.send({
        to,
        subject,
        // Version texte : les liens HTML deviennent leur simple adresse.
        text: `Bonjour,\n\n${lines.map((line) => line.replace(/<a href="([^"]+)">[^<]*<\/a>/g, "$1")).join("\n\n")}\n\nL'équipe La Foulée`,
        html: lines.map((line) => `<p>${line}</p>`).join(""),
      });
    } catch (error) {
      this.logger.error(`Email "${subject}" non envoyé : ${String(error)}`);
    }
  }

  private async createToken(
    user: User,
    purpose: EmailTokenPurpose,
    ttlMs: number,
    email: string,
    metadata?: Record<string, string>,
  ): Promise<string> {
    // Un seul lien valable à la fois pour un même usage.
    await this.prisma.emailToken.updateMany({
      where: { userId: user.id, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = randomToken();
    await this.prisma.emailToken.create({
      data: {
        userId: user.id,
        email,
        purpose,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + ttlMs),
        metadata,
      },
    });
    return token;
  }

  private async consumeToken(token: string, purpose: EmailTokenPurpose) {
    const record = await this.prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt < new Date() || !record.userId) {
      throw new ForbiddenException("Ce lien est invalide ou a expiré.");
    }
    // Consommation conditionnelle : deux clics simultanés ne servent qu'une fois.
    const { count } = await this.prisma.emailToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) throw new ForbiddenException("Ce lien a déjà été utilisé.");
    return { ...record, userId: record.userId };
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async profile(userId: string): Promise<AccountProfileDto> {
    const user = await this.activeUser(userId);
    return {
      email: user.email,
      firstName: user.firstName,
      role: user.role,
      twoFactorEnabled: Boolean(user.totpSecretEnc),
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<AccountProfileDto> {
    await this.activeUser(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { firstName: input.firstName } });
    return this.profile(userId);
  }

  /** Nouveau mot de passe : les autres appareils sont déconnectés, celui-ci reçoit une session neuve. */
  async changePassword(userId: string, input: PasswordChangeInput): Promise<IssuedSession> {
    const user = await this.activeUser(userId);
    await this.requirePassword(user, input.currentPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.revokeAllSessions(userId);
    await this.notify(user.email, "Votre mot de passe a été modifié", [
      "Le mot de passe de votre compte La Foulée vient d'être modifié. Vos autres appareils ont été déconnectés.",
      "Si vous n'êtes pas à l'origine de ce changement, utilisez « Mot de passe oublié » sur la page de connexion.",
    ]);
    return this.auth.startSession(await this.activeUser(userId));
  }

  /**
   * Changement d'email : rien ne change tant que la nouvelle adresse n'est pas confirmée
   * par le lien reçu. L'ancienne adresse est prévenue. Réponse identique si l'adresse est
   * déjà prise (on ne révèle pas quels comptes existent).
   */
  async requestEmailChange(userId: string, input: EmailChangeInput): Promise<void> {
    const user = await this.activeUser(userId);
    await this.requirePassword(user, input.currentPassword);
    if (input.newEmail === user.email) throw new BadRequestException("C'est déjà votre adresse email.");
    const taken = await this.prisma.user.findUnique({ where: { email: input.newEmail } });
    if (taken) {
      await this.notify(input.newEmail, "Changement d'adresse impossible", [
        "Quelqu'un a demandé à utiliser cette adresse pour un compte La Foulée, mais elle est déjà liée à un compte. Aucune modification n'a été faite.",
      ]);
      return;
    }
    const token = await this.createToken(user, "EMAIL_CHANGE", EMAIL_CHANGE_TTL_MS, input.newEmail, {
      newEmail: input.newEmail,
    });
    const link = `${this.config.APP_ORIGIN}/email/confirmer?token=${token}`;
    await this.notify(input.newEmail, "Confirmez votre nouvelle adresse email", [
      "Pour utiliser cette adresse avec votre compte La Foulée, ouvrez ce lien (valable 24 heures) :",
      `<a href="${link}">${link}</a>`,
    ]);
    await this.notify(user.email, "Demande de changement d'adresse email", [
      `Une demande de changement d'adresse vers ${input.newEmail} a été faite sur votre compte. Elle ne prendra effet qu'après confirmation depuis la nouvelle adresse.`,
      "Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe.",
    ]);
  }

  async confirmEmailChange(token: string): Promise<void> {
    const record = await this.consumeToken(token, "EMAIL_CHANGE");
    const newEmail = (record.metadata as { newEmail?: string } | null)?.newEmail;
    if (!newEmail) throw new ForbiddenException("Ce lien est invalide ou a expiré.");
    if (await this.prisma.user.findUnique({ where: { email: newEmail } })) {
      throw new ForbiddenException("Cette adresse est déjà utilisée par un autre compte.");
    }
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { email: newEmail, emailVerifiedAt: new Date() },
    });
  }

  /** Mot de passe oublié : réponse identique dans tous les cas ; lien valable 1 heure. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.anonymizedAt || !user.emailVerifiedAt) return;
    const token = await this.createToken(user, "PASSWORD_RESET", RESET_TTL_MS, user.email);
    const link = `${this.config.APP_ORIGIN}/mot-de-passe/nouveau?token=${token}`;
    await this.notify(user.email, "Réinitialisez votre mot de passe", [
      "Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure, une seule fois) :",
      `<a href="${link}">${link}</a>`,
      "Si vous n'avez rien demandé, ignorez ce message : votre mot de passe actuel reste valable.",
    ]);
  }

  /**
   * Nouveau mot de passe depuis le lien reçu. Toutes les sessions sont fermées.
   * La double authentification reste exigée à la prochaine connexion.
   */
  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await this.consumeToken(input.token, "PASSWORD_RESET");
    const user = await this.activeUser(record.userId);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await this.passwords.hash(input.newPassword) },
    });
    await this.revokeAllSessions(user.id);
    await this.notify(user.email, "Votre mot de passe a été réinitialisé", [
      "Le mot de passe de votre compte La Foulée vient d'être réinitialisé. Tous vos appareils ont été déconnectés.",
    ]);
  }

  async startTwoFactor(userId: string, currentPassword: string): Promise<TwoFactorSetupDto> {
    const user = await this.activeUser(userId);
    await this.requirePassword(user, currentPassword);
    if (user.totpSecretEnc) throw new BadRequestException("La double authentification est déjà active.");
    const { secret, uri } = await this.totp.startEnrollment(user.id, user.email);
    const qrSvg = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return { qrSvg, secret };
  }

  async enableTwoFactor(userId: string, code: string): Promise<AccountProfileDto> {
    const user = await this.activeUser(userId);
    const secretEnc = await this.totp.confirmEnrollment(user.id, code);
    if (!secretEnc) throw new BadRequestException("Code incorrect ou délai dépassé. Recommencez l'activation.");
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: secretEnc } });
    await this.notify(user.email, "Double authentification activée", [
      "La double authentification est maintenant active sur votre compte La Foulée. Un code de votre application vous sera demandé à chaque connexion.",
    ]);
    return this.profile(userId);
  }

  /** Les administrateurs ne peuvent pas la désactiver : elle leur est obligatoire. */
  async disableTwoFactor(userId: string, currentPassword: string, code: string): Promise<AccountProfileDto> {
    const user = await this.activeUser(userId);
    if (user.role === "ADMIN")
      throw new ForbiddenException("La double authentification est obligatoire pour un administrateur.");
    if (!user.totpSecretEnc) throw new BadRequestException("La double authentification n'est pas active.");
    await this.requirePassword(user, currentPassword);
    if (!(await this.totp.check(user.id, user.totpSecretEnc, code))) throw new ForbiddenException("Code incorrect.");
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecretEnc: null } });
    await this.notify(user.email, "Double authentification désactivée", [
      "La double authentification a été désactivée sur votre compte La Foulée. Si vous n'êtes pas à l'origine de ce changement, changez votre mot de passe.",
    ]);
    return this.profile(userId);
  }
}
