import Link from "next/link";
import { Suspense } from "react";
import type { AdminCategoryDto, AdminProductDetailDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { ImageManager } from "./image-manager";
import { ProductEditor } from "./product-editor";
import { StockGrid } from "./stock-grid";
import { VariantForm } from "./variant-form";

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
  const [product, categories] = await Promise.all([
    adminGet<AdminProductDetailDto>(`/products/${id}`),
    adminGet<AdminCategoryDto[]>("/categories"),
  ]);
  return (
    <div className="mt-2 space-y-8">
      <h1 className="font-display tracking-tight text-4xl font-extrabold">
        {product.brand} {product.name}
      </h1>
      <ProductEditor product={product} categories={categories} />
      <ImageManager product={product} />
      <VariantForm productId={product.id} />
      {product.variants.length > 0 ? (
        <StockGrid product={product} />
      ) : (
        <p>Ajoutez au moins une taille pour saisir le stock, puis publiez le produit.</p>
      )}
    </div>
  );
}
