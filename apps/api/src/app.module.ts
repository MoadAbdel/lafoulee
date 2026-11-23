import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module.js";
import { AuditModule } from "./audit/audit.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CartModule } from "./cart/cart.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ConfigModule } from "./config/config.module.js";
import { HealthModule } from "./health/health.module.js";
import { MailModule } from "./mail/mail.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { PrivacyModule } from "./privacy/privacy.module.js";
import { RedisModule } from "./redis/redis.module.js";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    MailModule,
    AuthModule,
    CatalogModule,
    CartModule,
    OrdersModule,
    AuditModule,
    AdminModule,
    PrivacyModule,
    HealthModule,
  ],
})
export class AppModule {}
