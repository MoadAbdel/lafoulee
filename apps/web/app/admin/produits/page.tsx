import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminProductQuerySchema, formatPrice, type AdminListDto, type AdminProductRowDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";

export const metadata: Metadata = { title: "Produits et stocks" };

const STATUS = { DRAFT: "Brouillon", PUBLISHED: "Publié", ARCHIVED: "Archivé" } as const;

export default function AdminProductsPage({ searchParams }: PageProps<"/admin/produits">) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-bold uppercase">Produits et stocks</h1>
        <Link
          href="/admin/produits/nouveau"
          className="min-h-11 content-center bg-balise px-5 font-semibold text-craie"
        >
          Nouveau produit
        </Link>
      </div>
      <Suspense fallback={<p className="mt-4">Chargement des produits...</p>}>
        <Products searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Products({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const parsed = adminProductQuerySchema.safeParse({ q: raw.q || undefined, page: raw.page ?? 1 });
  const query = parsed.success ? parsed.data : { page: 1 };
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.q) params.set("q", query.q);
  const list = await adminGet<AdminListDto<AdminProductRowDto>>(`/products?${params}`);

  return (
    <div className="mt-4 space-y-4">
      <form action="/admin/produits" role="search" className="flex gap-2">
        <label htmlFor="q-admin" className="sr-only">
          Rechercher un produit
        </label>
        <input
          id="q-admin"
          name="q"
          defaultValue={query.q}
          placeholder="Nom, marque..."
          className="min-h-11 flex-1 border border-asphalte/40 bg-white px-3"
        />
        <button type="submit" className="min-h-11 bg-asphalte px-4 font-semibold text-craie">
          Rechercher
        </button>
      </form>
      <table className="w-full border border-asphalte/15 bg-white text-left text-sm">
        <caption className="sr-only">Produits</caption>
        <thead className="bg-craie">
          <tr>
            <th scope="col" className="p-2">
              Produit
            </th>
            <th scope="col" className="p-2">
              Prix
            </th>
            <th scope="col" className="p-2">
              Statut
            </th>
            <th scope="col" className="p-2 text-right">
              Disponible
            </th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((product) => (
            <tr key={product.id} className="border-t border-asphalte/10">
              <td className="p-2">
                <Link href={`/admin/produits/${product.id}`} className="font-semibold underline underline-offset-4">
                  {product.brand} {product.name}
                </Link>
                <span className="block text-asphalte/70">{product.variantCount} variantes</span>
              </td>
              <td className="p-2">{formatPrice(product.priceCents)}</td>
              <td className="p-2">{STATUS[product.status]}</td>
              <td className={`p-2 text-right ${product.totalAvailable === 0 ? "font-semibold text-balise" : ""}`}>
                {product.totalAvailable}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-4">
          {query.page > 1 && (
            <Link
              href={`/admin/produits?${new URLSearchParams({ ...(query.q ? { q: query.q } : {}), page: String(query.page - 1) })}`}
              className="underline underline-offset-4"
            >
              Page précédente
            </Link>
          )}
          <span>
            Page {query.page} sur {list.totalPages}
          </span>
          {query.page < list.totalPages && (
            <Link
              href={`/admin/produits?${new URLSearchParams({ ...(query.q ? { q: query.q } : {}), page: String(query.page + 1) })}`}
              className="underline underline-offset-4"
            >
              Page suivante
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
