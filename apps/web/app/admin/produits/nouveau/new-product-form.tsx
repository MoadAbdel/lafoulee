"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { productCreateSchema, type AdminCategoryDto, type AdminProductDetailDto } from "@lafoulee/shared";
import { FormErrors, inputClass } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";
import { CategoryCheckboxes, checkedCategories, parsePriceCents } from "../catalog-fields";

/** Création d'un produit (EA03). Le lien public est construit à partir de la marque et du nom. */
export function NewProductForm({ categories }: { categories: AdminCategoryDto[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = productCreateSchema.safeParse({
      name: String(form.get("name") ?? ""),
      brand: String(form.get("brand") ?? ""),
      shortDescription: String(form.get("shortDescription") ?? ""),
      description: String(form.get("description") ?? ""),
      priceCents: parsePriceCents(form.get("price")),
      categorySlugs: checkedCategories(form),
    });
    if (!parsed.success) {
      setErrors([...new Set(parsed.error.issues.map((issue) => issue.message))]);
      return;
    }
    setPending(true);
    setErrors([]);
    const result = await postJson<AdminProductDetailDto>("/admin/products", parsed.data);
    if (result.ok) {
      router.push(`/admin/produits/${result.data.id}`);
    } else {
      setPending(false);
      setErrors(result.error.messages);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4 border border-asphalte/15 bg-white p-4">
      <FormErrors messages={errors} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-brand" className="font-semibold">
            Marque
          </label>
          <input id="new-brand" name="brand" className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-name" className="font-semibold">
            Nom
          </label>
          <input id="new-name" name="name" className={inputClass} />
        </div>
        <div>
          <label htmlFor="new-price" className="font-semibold">
            Prix (euros)
          </label>
          <input id="new-price" name="price" inputMode="decimal" placeholder="119,90" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="new-short" className="font-semibold">
          Accroche (160 caractères max.)
        </label>
        <input id="new-short" name="shortDescription" maxLength={160} className={inputClass} />
      </div>
      <div>
        <label htmlFor="new-description" className="font-semibold">
          Description
        </label>
        <textarea id="new-description" name="description" rows={5} className={`${inputClass} py-2`} />
      </div>
      <CategoryCheckboxes categories={categories} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 bg-balise px-5 font-semibold text-craie disabled:opacity-60"
      >
        {pending ? "Création..." : "Créer le produit en brouillon"}
      </button>
    </form>
  );
}
