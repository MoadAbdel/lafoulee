import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { AdminCategoryDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { NewProductForm } from "./new-product-form";

export const metadata: Metadata = { title: "Nouveau produit" };

export default function NewProductPage() {
  return (
    <>
      <Link href="/admin/produits" className="text-sm underline underline-offset-4">
        Retour aux produits
      </Link>
      <h1 className="mt-2 font-display tracking-tight text-4xl font-extrabold">Nouveau produit</h1>
      <p className="mt-2 text-asphalte/80">
        Le produit est créé en brouillon. Ajoutez ensuite ses tailles, son stock et ses photos, puis publiez-le.
      </p>
      <Suspense fallback={<p className="mt-4">Chargement des catégories...</p>}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const categories = await adminGet<AdminCategoryDto[]>("/categories");
  return <NewProductForm categories={categories} />;
}
