import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { ENV, type Env } from "../config/env.js";

/**
 * Client Prisma partagé. Sur Vercel (Fluid Compute), une instance de fonction
 * sert plusieurs requêtes : le pool de connexions est donc réutilisé.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENV) config: Env) {
    super({ adapter: new PrismaPg({ connectionString: withStrictSsl(config.DATABASE_URL), max: 5 }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/**
 * Neon fournit des URL en sslmode=require. Le pilote pg les traite déjà comme
 * verify-full (certificat et nom d'hôte vérifiés) : on l'écrit explicitement,
 * ce qui supprime l'avertissement et garde ce niveau lors des futures versions.
 */
export function withStrictSsl(url: string): string {
  return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/, "$1verify-full");
}
