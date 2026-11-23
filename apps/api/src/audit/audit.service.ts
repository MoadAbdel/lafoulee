import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { Prisma } from "../generated/prisma/client.js";

export interface AuditContext {
  actorId: string;
  ip: string;
}

/**
 * Journal d'audit (dossier, C21 et EA08) : chaque action d'un administrateur
 * est enregistrée (qui, quoi, sur quel objet, quand, depuis quelle IP).
 * Conservation : 1 an (purge par la tâche de nuit).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    context: AuditContext,
    action: string,
    entity: string,
    entityId: string | null,
    details?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: { actorId: context.actorId, ip: context.ip, action, entity, entityId, details },
    });
  }
}
