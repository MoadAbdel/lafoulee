import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatPrice } from "@lafoulee/shared";
import { ProductVisual } from "@/components/product-visual";
import { getProduct } from "@/lib/catalog";
import { VariantPicker } from "./variant-picker";

/**
 * Avec Cache Components, une route dynamique doit déclarer au moins un paramètre.
 * L'API n'étant pas joignable pendant le build, on déclare une coquille : chaque
 * fiche réelle est rendue à la première visite, puis servie depuis le cache.
 */
const SHELL = "__coquille__";

export function generateStaticParams() {
  return [{ slug: SHELL }];
}

export async function generateMetadata({ params }: PageProps<"/produits/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  if (slug === SHELL) return {};
  const product = await getProduct(slug);
  if (!product) return { title: "Produit introuvable" };
  return {
    title: `${product.brand} ${product.name}`,
    description: product.shortDescription,
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: { title: `${product.brand} ${product.name}`, description: product.shortDescription, type: "website" },
  };
}

/**
 * Le produit est lu avant tout rendu (hors Suspense) : un produit inconnu
 * renvoie ainsi un vrai code 404, et non une page "introuvable" en 200.
 */
export default async function ProductPage({ params }: PageProps<"/produits/[slug]">) {
  const { slug } = await params;
  if (slug === SHELL) notFound();
  const product = await getProduct(slug);
  if (!product) notFound();

  const prices = product.variants.map((variant) => variant.priceCents);
  const minPrice = Math.min(...prices);
  const inStock = product.variants.some((variant) => variant.totalAvailable > 0);
  const category = product.categories[0];

  // Données structurées Product (SEO, dossier C20) : prix et disponibilité.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${product.brand} ${product.name}`,
    brand: { "@type": "Brand", name: product.brand },
    description: product.shortDescription,
    sku: product.variants[0]?.sku,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "EUR",
      lowPrice: (minPrice / 100).toFixed(2),
      highPrice: (Math.max(...prices) / 100).toFixed(2),
      offerCount: product.variants.length,
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  return (
    <article className="mx-auto max-w-6xl px-4 py-10">
      <script
        type="application/ld+json"
        // JSON sérialisé par nos soins, "<" échappé : aucun HTML injectable.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Fil d'Ariane" className="text-sm">
        <ol className="flex flex-wrap gap-2 text-asphalte/80">
          <li>
            <Link href="/" className="underline underline-offset-4">
              Accueil
            </Link>{" "}
            /
          </li>
          {category && (
            <li>
              <Link href={`/produits?categorie=${category.slug}`} className="underline underline-offset-4">
                {category.name}
              </Link>{" "}
              /
            </li>
          )}
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ProductVisual
          brand={product.brand}
          name={product.name}
          imageUrl={product.images[0]?.url ?? null}
          imageAlt={product.images[0]?.alt ?? null}
          priority
        />
        <div>
          <p className="font-semibold uppercase tracking-wide text-foret">{product.brand}</p>
          <h1 className="font-display text-5xl font-bold uppercase leading-none">{product.name}</h1>
          <p className="mt-3 text-lg">{product.shortDescription}</p>
          <p className="mt-4 text-2xl font-semibold">
            {prices.every((price) => price === minPrice)
              ? formatPrice(minPrice)
              : `À partir de ${formatPrice(minPrice)}`}
          </p>
          <VariantPicker variants={product.variants} stores={product.stores} />
        </div>
      </div>

      <section aria-labelledby="titre-description" className="mt-12 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 id="titre-description" className="font-display text-3xl font-bold uppercase">
            Description
          </h2>
          <p className="mt-3 leading-relaxed">{product.description}</p>
        </div>
        {Object.keys(product.attributes).length > 0 && (
          <div>
            <h2 className="font-display text-3xl font-bold uppercase">Caractéristiques</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              {Object.entries(product.attributes).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-semibold capitalize">{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </article>
  );
}
