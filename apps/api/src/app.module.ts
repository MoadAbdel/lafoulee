import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { MailModule } from "./mail/mail.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, MailModule, AuthModule, CatalogModule, HealthModule],
})
export class AppModule {}
