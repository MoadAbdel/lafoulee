import Link from "next/link";
import { formatPrice, type ProductCardDto } from "@lafoulee/shared";
import { ProductVisual } from "./product-visual";

export function ProductCard({ product }: { product: ProductCardDto }) {
  return (
    <article className="group relative flex flex-col border border-asphalte/15 bg-white">
      <ProductVisual
        brand={product.brand}
        name={product.name}
        imageUrl={product.imageUrl}
        imageAlt={product.imageAlt}
      />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-foret">{product.brand}</p>
        <h3 className="font-display text-2xl font-semibold uppercase leading-tight">
          {/* Le lien couvre toute la carte (pseudo-élément) tout en gardant un seul lien accessible. */}
          <Link href={`/produits/${product.slug}`} className="after:absolute after:inset-0 group-hover:text-balise">
            {product.name}
          </Link>
        </h3>
        <p className="text-sm text-asphalte/80">{product.shortDescription}</p>
        <p className="mt-auto pt-3 font-semibold">
          {product.inStock ? (
            <>
              <span className="sr-only">Prix : </span>à partir de {formatPrice(product.fromPriceCents)}
            </>
          ) : (
            <span className="text-asphalte/70">Rupture de stock</span>
          )}
        </p>
      </div>
    </article>
  );
}
