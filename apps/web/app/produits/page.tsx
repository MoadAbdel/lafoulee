import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { productListQuerySchema, type ProductListQuery } from "@lafoulee/shared";
import { CatalogSkeleton } from "@/components/catalog-skeleton";
import { ProductCard } from "@/components/product-card";
import { getCategories, getProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Chaussures de route et de trail, textile, nutrition et accessoires de course à pied.",
};

const SORT_LABELS = {
  pertinence: "Pertinence",
  nouveautes: "Nouveautés",
  "prix-croissant": "Prix croissant",
  "prix-decroissant": "Prix décroissant",
} as const;

type Search = Record<string, string | string[] | undefined>;

function parseQuery(search: Search): ProductListQuery {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const parsed = productListQuerySchema.safeParse({
    q: first(search.q) || undefined,
    categorie: first(search.categorie) || undefined,
    page: first(search.page) ?? 1,
    tri: first(search.tri) || undefined,
  });
  return parsed.success ? parsed.data : { page: 1 };
}

function href(query: ProductListQuery, changes: Partial<ProductListQuery>): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.categorie) params.set("categorie", next.categorie);
  if (next.tri) params.set("tri", next.tri);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/produits?${qs}` : "/produits";
}

export default function ProductsPage({ searchParams }: PageProps<"/produits">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Catalog({ searchParams }: { searchParams: Promise<Search> }) {
  const query = parseQuery(await searchParams);
  const [list, categories] = await Promise.all([getProducts(query), getCategories()]);
  const current = categories.find((category) => category.slug === query.categorie);
  const title = query.q ? `Résultats pour « ${query.q} »` : (current?.name ?? "Tout le catalogue");

  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase sm:text-5xl">{title}</h1>
      {current && !query.q && <p className="mt-2 max-w-2xl text-asphalte/80">{current.description}</p>}

      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <nav aria-label="Filtrer par catégorie">
          <ul className="flex flex-wrap gap-2">
            <li>
              <FilterLink href={href(query, { categorie: undefined, page: 1 })} active={!query.categorie}>
                Tout
              </FilterLink>
            </li>
            {categories.map((category) => (
              <li key={category.slug}>
                <FilterLink
                  href={href(query, { categorie: category.slug, page: 1 })}
                  active={query.categorie === category.slug}
                >
                  {category.name}
                </FilterLink>
              </li>
            ))}
          </ul>
        </nav>
        <form action="/produits" className="flex items-end gap-2">
          {query.q && <input type="hidden" name="q" value={query.q} />}
          {query.categorie && <input type="hidden" name="categorie" value={query.categorie} />}
          <label className="flex flex-col text-sm font-semibold">
            Trier par
            <select
              name="tri"
              defaultValue={query.tri ?? (query.q ? "pertinence" : "nouveautes")}
              className="mt-1 min-h-11 border border-asphalte/40 bg-white px-2 font-normal"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-11 border border-asphalte px-4 font-semibold">
            Appliquer
          </button>
        </form>
      </div>

      <p role="status" className="mt-6 text-sm text-asphalte/80">
        {list.total} produit{list.total > 1 ? "s" : ""}
      </p>

      {list.items.length === 0 ? (
        <p className="mt-6">
          Aucun produit ne correspond.{" "}
          <Link href="/produits" className="font-semibold underline underline-offset-4">
            Voir tout le catalogue
          </Link>
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.items.map((product) => (
            <li key={product.slug}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}

      {list.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4">
          {query.page > 1 && (
            <Link
              href={href(query, { page: query.page - 1 })}
              rel="prev"
              className="min-h-11 content-center font-semibold underline underline-offset-4"
            >
              Page précédente
            </Link>
          )}
          <span aria-current="page">
            Page {Math.min(query.page, list.totalPages)} sur {list.totalPages}
          </span>
          {query.page < list.totalPages && (
            <Link
              href={href(query, { page: query.page + 1 })}
              rel="next"
              className="min-h-11 content-center font-semibold underline underline-offset-4"
            >
              Page suivante
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function FilterLink({ href: target, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={target}
      aria-current={active ? "page" : undefined}
      className={`block min-h-11 content-center border px-3 text-sm font-semibold ${
        active ? "border-asphalte bg-asphalte text-craie" : "border-asphalte/30 bg-white hover:border-balise"
      }`}
    >
      {children}
    </Link>
  );
}
