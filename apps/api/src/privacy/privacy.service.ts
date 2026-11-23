import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ConsentInput, GdprRequestDto, GdprRequestType, PrivacyRequestInput } from "@lafoulee/shared";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import { PasswordService } from "../auth/password.service.js";
import { ENV, type Env } from "../config/env.js";
import { randomToken, sha256 } from "../common/crypto.js";
import { MailService } from "../mail/mail.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";

const DAY = 24 * 3600 * 1000;
const ANONYMIZED_ADDRESS = { anonymise: true };

/**
 * Droits des personnes (RGPD, articles 15 à 17 ; dossier C11, EF11, EA06) et
 * durées de conservation (dossier C9).
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    @Inject(ENV) private readonly config: Env,
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  /** Preuve du choix de consentement (article 7.1) : identifiant aléatoire, version, choix, date. */
  async recordConsent(input: ConsentInput): Promise<void> {
    await this.prisma.consentLog.create({
      data: { consentId: input.consentId, version: input.version, choices: input.choices },
    });
  }

  /** Toutes les données personnelles liées à une adresse email (droit d'accès et portabilité). */
  async exportByEmail(email: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
      },
    });
    const orders = await this.prisma.order.findMany({
      where: user ? { OR: [{ userId: user.id }, { guestEmail: email }] } : { guestEmail: email },
      include: { lines: true, pickupStore: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const newsletter = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
      select: { status: true, createdAt: true, confirmedAt: true },
    });
    return {
      exporteLe: new Date().toISOString(),
      responsableDuTraitement: "La Foulée (enseigne fictive, projet de démonstration)",
      compte: user,
      commandes: orders.map((order) => ({
        numero: order.number,
        date: order.createdAt,
        statut: order.status,
        mode: order.fulfillment,
        boutique: order.pickupStore?.name ?? null,
        adresseDeLivraison: order.shippingAddress,
        totalCentimes: order.totalCents,
        articles: order.lines.map((line) => ({
          produit: line.productName,
          variante: line.variantLabel,
          quantite: line.quantity,
          prixUnitaireCentimes: line.unitPriceCents,
        })),
      })),
      newsletter,
    };
  }

  async exportForUser(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.anonymizedAt) throw new NotFoundException("Compte introuvable.");
    return this.exportByEmail(user.email);
  }

  /** Suppression du compte par son titulaire (mot de passe redemandé). */
  async deleteOwnAccount(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.anonymizedAt) throw new NotFoundException("Compte introuvable.");
    if (user.role === "ADMIN")
      throw new ForbiddenException("Un compte administrateur ne se supprime pas depuis le site.");
    if (!(await this.passwords.verify(user.passwordHash, password)))
      throw new UnauthorizedException("Mot de passe incorrect.");
    await this.prisma.$transaction(async (tx) => {
      await this.anonymize(tx, user.email);
      await tx.gdprRequest.create({
        data: { email: "compte-supprime", type: "DELETION", status: "DONE", dueAt: new Date(), closedAt: new Date() },
      });
    });
  }

  /**
   * Anonymisation (RG5) : le compte et les commandes restent (obligation comptable
   * de 10 ans), mais plus rien ne permet d'identifier la personne.
   */
  private async anonymize(tx: Prisma.TransactionClient, email: string): Promise<void> {
    const user = await tx.user.findUnique({ where: { email } });
    if (user && !user.anonymizedAt) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `supprime-${randomUUID()}@anonyme.invalid`,
          firstName: null,
          passwordHash: `supprime:${randomToken()}`,
          totpSecretEnc: null,
          anonymizedAt: new Date(),
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.emailToken.deleteMany({ where: { userId: user.id } });
      await tx.order.updateMany({
        where: { userId: user.id, fulfillment: "DELIVERY" },
        data: { shippingAddress: ANONYMIZED_ADDRESS },
      });
    }
    await tx.order.updateMany({
      where: { guestEmail: email, fulfillment: "DELIVERY" },
      data: { shippingAddress: ANONYMIZED_ADDRESS },
    });
    await tx.order.updateMany({ where: { guestEmail: email }, data: { guestEmail: null } });
    await tx.newsletterSubscription.deleteMany({ where: { email } });
    await tx.emailToken.deleteMany({ where: { email } });
  }

  /**
   * Demande d'un visiteur sans compte (ou qui ne peut pas se connecter) : un lien
   * de confirmation est envoyé à l'adresse, pour qu'on ne puisse pas demander
   * les données de quelqu'un d'autre. La réponse ne révèle rien.
   */
  async requestByEmail(input: PrivacyRequestInput): Promise<void> {
    const token = randomToken();
    await this.prisma.emailToken.create({
      data: {
        email: input.email,
        purpose: "GDPR_REQUEST",
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + DAY),
        metadata: { type: input.type },
      },
    });
    const label = input.type === "ACCESS" ? "recevoir une copie de vos données" : "supprimer vos données";
    const link = `${this.config.APP_ORIGIN}/confidentialite/confirmer?token=${token}`;
    await this.mail
      .send({
        to: input.email,
        subject: "Confirmez votre demande concernant vos données",
        text: `Bonjour,\n\nVous avez demandé à ${label}. Pour confirmer, ouvrez ce lien (valable 24 heures) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
        html: `<p>Bonjour,</p><p>Vous avez demandé à ${label}. Pour confirmer, cliquez sur ce lien (valable 24 heures) :</p><p><a href="${link}">Confirmer ma demande</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
      })
      .catch((error: unknown) => this.logger.error(`Email de demande RGPD non envoyé : ${String(error)}`));
  }

  /** Confirmation : la demande est ouverte, avec une échéance d'un mois (article 12.3). */
  async confirmRequest(token: string): Promise<GdprRequestType> {
    const record = await this.prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
    const type = (record?.metadata as { type?: GdprRequestType } | null)?.type;
    if (!record || record.purpose !== "GDPR_REQUEST" || record.usedAt || record.expiresAt < new Date() || !type) {
      throw new ForbiddenException("Ce lien est invalide ou a expiré.");
    }
    const user = await this.prisma.user.findUnique({ where: { email: record.email } });
    await this.prisma.$transaction([
      this.prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      this.prisma.gdprRequest.create({
        data: { email: record.email, userId: user?.id ?? null, type, dueAt: new Date(Date.now() + 30 * DAY) },
      }),
    ]);
    return type;
  }

  async listRequests(): Promise<GdprRequestDto[]> {
    const rows = await this.prisma.gdprRequest.findMany({
      where: { NOT: { email: "compte-supprime" } },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      type: row.type,
      status: row.status,
      hasAccount: row.userId !== null,
      createdAt: row.createdAt.toISOString(),
      dueAt: row.dueAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      overdue: row.status === "OPEN" && row.dueAt < new Date(),
    }));
  }

  /** Traitement par l'administrateur (EA06) : envoi de l'export, ou anonymisation. Journalisé. */
  async processRequest(context: AuditContext, id: string): Promise<GdprRequestDto> {
    const request = await this.prisma.gdprRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException("Demande introuvable.");
    if (request.status === "DONE") throw new ForbiddenException("Demande déjà traitée.");

    if (request.type === "ACCESS") {
      const data = await this.exportByEmail(request.email);
      await this.mail.send({
        to: request.email,
        subject: "Vos données personnelles",
        text: "Bonjour,\n\nVous trouverez en pièce jointe une copie de vos données personnelles, au format JSON.\n\nLa Foulée",
        html: "<p>Bonjour,</p><p>Vous trouverez en pièce jointe une copie de vos données personnelles, au format JSON.</p><p>La Foulée</p>",
        attachments: [{ name: "mes-donnees-la-foulee.json", content: JSON.stringify(data, null, 2) }],
      });
      await this.prisma.gdprRequest.update({ where: { id }, data: { status: "DONE", closedAt: new Date() } });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await this.anonymize(tx, request.email);
        // L'email de la demande est lui-même une donnée personnelle : on ne le garde pas.
        await tx.gdprRequest.update({
          where: { id },
          data: { status: "DONE", closedAt: new Date(), email: "supprime", userId: null },
        });
      });
    }
    await this.audit.record(context, `gdpr.${request.type.toLowerCase()}`, "gdpr-request", id);
    return (await this.listRequests()).find((row) => row.id === id) ?? this.closedDto(id);
  }

  private async closedDto(id: string): Promise<GdprRequestDto> {
    const row = await this.prisma.gdprRequest.findUniqueOrThrow({ where: { id } });
    return {
      id: row.id,
      email: row.email,
      type: row.type,
      status: row.status,
      hasAccount: row.userId !== null,
      createdAt: row.createdAt.toISOString(),
      dueAt: row.dueAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      overdue: row.status === "OPEN" && row.dueAt < new Date(),
    };
  }

  // ---------- Newsletter (EF10, double opt-in) ----------

  /** Signature du lien de désinscription : HMAC de l'adresse, rien à stocker. */
  unsubscribeSignature(email: string): string {
    return createHmac("sha256", this.config.CRON_SECRET).update(`newsletter:${email}`).digest("hex");
  }

  async subscribe(email: string): Promise<void> {
    const existing = await this.prisma.newsletterSubscription.findUnique({ where: { email } });
    if (existing?.status === "CONFIRMED") return; // même réponse : on ne révèle pas qui est abonné
    const token = randomToken();
    await this.prisma.newsletterSubscription.upsert({
      where: { email },
      update: { status: "PENDING", tokenHash: sha256(token), confirmedAt: null, createdAt: new Date() },
      create: { email, tokenHash: sha256(token) },
    });
    const link = `${this.config.APP_ORIGIN}/newsletter/confirmer?token=${token}`;
    await this.mail
      .send({
        to: email,
        subject: "Confirmez votre inscription à la newsletter",
        text: `Bonjour,\n\nPour recevoir la newsletter de La Foulée (nouveautés, produits de saison), confirmez votre inscription :\n${link}\n\nSans confirmation sous 7 jours, votre adresse est effacée.`,
        html: `<p>Bonjour,</p><p>Pour recevoir la newsletter de La Foulée (nouveautés, produits de saison), confirmez votre inscription :</p><p><a href="${link}">Confirmer mon inscription</a></p><p>Sans confirmation sous 7 jours, votre adresse est effacée.</p>`,
      })
      .catch((error: unknown) => this.logger.error(`Email de confirmation newsletter non envoyé : ${String(error)}`));
  }

  async confirmSubscription(token: string): Promise<void> {
    const subscription = await this.prisma.newsletterSubscription.findUnique({ where: { tokenHash: sha256(token) } });
    if (!subscription || subscription.status !== "PENDING" || subscription.createdAt < new Date(Date.now() - 7 * DAY)) {
      throw new ForbiddenException("Ce lien est invalide ou a expiré.");
    }
    await this.prisma.newsletterSubscription.update({
      where: { id: subscription.id },
      data: { status: "CONFIRMED", confirmedAt: new Date(), tokenHash: null },
    });
    const query = new URLSearchParams({
      email: subscription.email,
      signature: this.unsubscribeSignature(subscription.email),
    });
    await this.mail
      .send({
        to: subscription.email,
        subject: "Inscription à la newsletter confirmée",
        text: `Merci, votre inscription est confirmée.\n\nPour vous désinscrire à tout moment : ${this.config.APP_ORIGIN}/newsletter/desinscription?${query}`,
        html: `<p>Merci, votre inscription est confirmée.</p><p><a href="${this.config.APP_ORIGIN}/newsletter/desinscription?${query}">Se désinscrire</a> à tout moment.</p>`,
      })
      .catch((error: unknown) => this.logger.error(`Email de bienvenue newsletter non envoyé : ${String(error)}`));
  }

  /** Désinscription en un clic : l'adresse est effacée (rien à conserver). */
  async unsubscribe(email: string, signature: string): Promise<void> {
    const expected = Buffer.from(this.unsubscribeSignature(email), "hex");
    const given = Buffer.from(signature, "hex");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new ForbiddenException("Lien de désinscription invalide.");
    }
    await this.prisma.newsletterSubscription.deleteMany({ where: { email } });
  }

  // ---------- Durées de conservation (tâche de nuit) ----------

  async applyRetention(now = new Date()): Promise<Record<string, number>> {
    const ago = (days: number) => new Date(now.getTime() - days * DAY);
    const [tokens, newsletter, consents, audit, refresh] = await Promise.all([
      this.prisma.emailToken.deleteMany({ where: { expiresAt: { lt: ago(7) } } }),
      this.prisma.newsletterSubscription.deleteMany({ where: { status: "PENDING", createdAt: { lt: ago(7) } } }),
      this.prisma.consentLog.deleteMany({ where: { createdAt: { lt: ago(182) } } }),
      this.prisma.auditLog.deleteMany({ where: { createdAt: { lt: ago(365) } } }),
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: ago(7) } } }),
    ]);
    // Comptes clients inactifs depuis 3 ans : anonymisés (référentiel CNIL de la gestion commerciale).
    const inactive = await this.prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        anonymizedAt: null,
        OR: [{ lastLoginAt: { lt: ago(3 * 365) } }, { lastLoginAt: null, createdAt: { lt: ago(3 * 365) } }],
      },
      select: { email: true },
      take: 200,
    });
    for (const user of inactive) await this.prisma.$transaction((tx) => this.anonymize(tx, user.email));
    return {
      jetons: tokens.count,
      newsletterNonConfirmees: newsletter.count,
      consentements: consents.count,
      journalAudit: audit.count,
      sessionsExpirees: refresh.count,
      comptesInactifsAnonymises: inactive.length,
    };
  }
}
