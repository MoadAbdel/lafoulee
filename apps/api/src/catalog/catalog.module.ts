import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog.controller.js";
import { CatalogInvalidationService } from "./catalog-invalidation.service.js";
import { CatalogService } from "./catalog.service.js";

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, CatalogInvalidationService],
  exports: [CatalogService, CatalogInvalidationService],
})
export class CatalogModule {}
