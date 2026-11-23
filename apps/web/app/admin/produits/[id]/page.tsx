import Link from "next/link";
import { Suspense } from "react";
import type { AdminProductDetailDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { ProductEditor } from "./product-editor";
import { StockGrid } from "./stock-grid";

export default function AdminProductPage({ params }: PageProps<"/admin/produits/[id]">) {
  return (
    <>
      <Link href="/admin/produits" className="text-sm underline underline-offset-4">
        Retour aux produits
      </Link>
      <Suspense fallback={<p className="mt-4">Chargement du produit...</p>}>
        <Product params={params} />
      </Suspense>
    </>
  );
}

async function Product({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return <p role="alert">Produit introuvable.</p>;
  const product = await adminGet<AdminProductDetailDto>(`/products/${id}`);
  return (
    <div className="mt-2 space-y-8">
      <h1 className="font-display text-4xl font-bold uppercase">
        {product.brand} {product.name}
      </h1>
      <ProductEditor product={product} />
      <StockGrid product={product} />
    </div>
  );
}
