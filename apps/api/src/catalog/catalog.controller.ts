import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  productListQuerySchema,
  slugParamSchema,
  type CategoryDto,
  type ProductDetailDto,
  type ProductListDto,
  type ProductListQuery,
  type StoreDto,
} from "@lafoulee/shared";
import { Public } from "../common/decorators.js";
import { CatalogService } from "./catalog.service.js";

/** Lecture publique du catalogue (EF01 à EF03). */
@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  categories(): Promise<CategoryDto[]> {
    return this.catalog.listCategories();
  }

  @Get("stores")
  stores(): Promise<StoreDto[]> {
    return this.catalog.listStores();
  }

  @Get("products")
  products(@Query({ schema: productListQuerySchema }) query: ProductListQuery): Promise<ProductListDto> {
    return this.catalog.listProducts(query);
  }

  @Get("products/:slug")
  product(@Param("slug", { schema: slugParamSchema }) slug: string): Promise<ProductDetailDto> {
    return this.catalog.getProduct(slug);
  }
}
