import { Module } from "@nestjs/common";
import { CatalogModule } from "../catalog/catalog.module.js";
import { OrdersModule } from "../orders/orders.module.js";
import { ApiKeyGuard } from "../partner/api-key.guard.js";
import { ApiKeysService } from "../partner/api-keys.service.js";
import { PartnerController } from "../partner/partner.controller.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { CatalogAdminService } from "./catalog-admin.service.js";
import { ImageStorage } from "./image-storage.js";

/** Back-office et API partenaires (qui partagent la gestion des clés API). */
@Module({
  imports: [OrdersModule, CatalogModule],
  controllers: [AdminController, PartnerController],
  providers: [AdminService, CatalogAdminService, ImageStorage, ApiKeysService, ApiKeyGuard],
})
export class AdminModule {}
