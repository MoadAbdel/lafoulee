import { Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { ApiKeyCreateInput, ApiKeyDto, ApiScope, CreatedApiKeyDto } from "@lafoulee/shared";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import { sha256 } from "../common/crypto.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { ApiKey } from "../generated/prisma/client.js";

const KEY_PATTERN = /^lf_live_([A-Za-z0-9]{8})_([A-Za-z0-9_-]{43})$/;

function toDto(key: ApiKey): ApiKeyDto {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes as ApiScope[],
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    revokedAt: key.revokedAt?.toISOString() ?? null,
  };
}

/**
 * Clés API partenaires (dossier, C24 et EA07).
 * Format : lf_live_<préfixe>_<secret>. Le préfixe (public) retrouve la clé,
 * le secret n'est jamais stocké : seule son empreinte SHA-256 l'est.
 * La clé complète n'est affichée qu'une fois, à la création.
 */
@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(context: AuditContext, input: ApiKeyCreateInput): Promise<CreatedApiKeyDto> {
    const prefix = randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8);
    const secret = randomBytes(32).toString("base64url");
    const key = await this.prisma.apiKey.create({
      data: { name: input.name, prefix, keyHash: sha256(secret), scopes: input.scopes, createdBy: context.actorId },
    });
    await this.audit.record(context, "api-key.create", "api-key", key.id, { name: input.name, scopes: input.scopes });
    return { ...toDto(key), key: `lf_live_${prefix}_${secret}` };
  }

  async list(): Promise<ApiKeyDto[]> {
    return (await this.prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } })).map(toDto);
  }

  /** Révocation immédiate : la clé est refusée dès la requête suivante. */
  async revoke(context: AuditContext, id: string): Promise<ApiKeyDto> {
    const { count } = await this.prisma.apiKey.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundException("Clé introuvable.");
    if (count > 0) await this.audit.record(context, "api-key.revoke", "api-key", id);
    return toDto(key);
  }

  /** Vérifie une clé présentée par un partenaire. Renvoie null si elle est inconnue, fausse ou révoquée. */
  async authenticate(raw: string): Promise<{ id: string; scopes: ApiScope[] } | null> {
    const match = KEY_PATTERN.exec(raw);
    if (!match) return null;
    const [, prefix, secret] = match as unknown as [string, string, string];
    const key = await this.prisma.apiKey.findUnique({ where: { prefix } });
    const expected = Buffer.from(key?.keyHash ?? "0".repeat(64), "hex");
    const given = Buffer.from(sha256(secret), "hex");
    if (!key || key.revokedAt || !timingSafeEqual(expected, given)) return null;
    // Mise à jour de la date de dernière utilisation, au plus une fois par minute.
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
      await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    }
    return { id: key.id, scopes: key.scopes as ApiScope[] };
  }
}
