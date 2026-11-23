import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { productListQuerySchema, slugParamSchema, type ProductListQuery } from "@lafoulee/shared";
import { Public } from "../common/decorators.js";
import { CatalogService } from "../catalog/catalog.service.js";
import { ApiKeyGuard, RequireScope } from "./api-key.guard.js";
import { OPENAPI_DOCUMENT } from "./openapi.js";

/**
 * API partenaires en lecture seule (dossier, C24, EP01) : clubs de course,
 * organisateurs de courses. Aucune donnée personnelle n'est exposée.
 * Pas de session : l'accès passe uniquement par la clé API.
 */
@Public()
@Controller("partner")
export class PartnerController {
  constructor(private readonly catalog: CatalogService) {}

  /** Description OpenAPI 3 de cette API (publique, sans clé). */
  @Get("openapi.json")
  openapi() {
    return OPENAPI_DOCUMENT;
  }

  @Get("products")
  @UseGuards(ApiKeyGuard)
  @RequireScope("catalog:read")
  products(@Query({ schema: productListQuerySchema }) query: ProductListQuery) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:slug")
  @UseGuards(ApiKeyGuard)
  @RequireScope("catalog:read")
  product(@Param("slug", { schema: slugParamSchema }) slug: string) {
    return this.catalog.getProduct(slug);
  }

  @Get("stores")
  @UseGuards(ApiKeyGuard)
  @RequireScope("stock:read")
  stores() {
    return this.catalog.listStores();
  }
}
