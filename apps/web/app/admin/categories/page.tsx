import type { Metadata } from "next";
import { Suspense } from "react";
import type { AdminCategoryDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Catégories" };

/** Catégories du catalogue (EA03) : elles forment le menu du site. */
export default function CategoriesPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Catégories</h1>
      <p className="mt-2 text-asphalte/80">
        L&apos;ordre fixe leur place dans le catalogue. Une catégorie qui contient des produits ne peut pas être
        supprimée.
      </p>
      <Suspense fallback={<p className="mt-4">Chargement des catégories...</p>}>
        <Categories />
      </Suspense>
    </>
  );
}

async function Categories() {
  const categories = await adminGet<AdminCategoryDto[]>("/categories");
  return <CategoryManager categories={categories} />;
}
