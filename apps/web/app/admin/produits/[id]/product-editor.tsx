"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  productUpdateSchema,
  type AdminCategoryDto,
  type AdminProductDetailDto,
  type ProductUpdateInput,
} from "@lafoulee/shared";
import { FormErrors, inputClass } from "@/components/form-errors";
import { apiRequest } from "@/lib/client-api";
import { CategoryCheckboxes, checkedCategories, parsePriceCents } from "../catalog-fields";

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

/** Modification d'un produit (EA03). Seuls les champs modifiés sont envoyés (et journalisés). */
export function ProductEditor({
  product,
  categories,
}: {
  product: AdminProductDetailDto;
  categories: AdminCategoryDto[];
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = parsePriceCents(form.get("price"));
    const candidate: Record<string, unknown> = {
      name: String(form.get("name")),
      brand: String(form.get("brand")),
      shortDescription: String(form.get("shortDescription")),
      description: String(form.get("description")),
      priceCents: price,
      status: String(form.get("status")),
    };
    const changes = Object.fromEntries(
      Object.entries(candidate).filter(([key, value]) => product[key as keyof AdminProductDetailDto] !== value),
    );
    const selected = checkedCategories(form);
    if (!sameList(selected, product.categorySlugs)) changes.categorySlugs = selected;
    const parsed = productUpdateSchema.safeParse(changes);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setPending(true);
    setErrors([]);
    const result = await apiRequest<AdminProductDetailDto>(
      "PATCH",
      `/admin/products/${product.id}`,
      parsed.data as ProductUpdateInput,
    );
    setPending(false);
    if (result.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  return (
    <form
      onSubmit={submit}
      onChange={() => setSaved(false)}
      noValidate
      className="space-y-4 border border-asphalte/15 bg-white p-4"
    >
      <h2 className="font-display text-2xl font-bold uppercase">Fiche</h2>
      <FormErrors messages={errors} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="font-semibold">
            Nom
          </label>
          <input id="name" name="name" defaultValue={product.name} className={inputClass} />
        </div>
        <div>
          <label htmlFor="brand" className="font-semibold">
            Marque
          </label>
          <input id="brand" name="brand" defaultValue={product.brand} className={inputClass} />
        </div>
        <div>
          <label htmlFor="price" className="font-semibold">
            Prix (euros)
          </label>
          <input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={(product.priceCents / 100).toFixed(2).replace(".", ",")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="status" className="font-semibold">
            Statut
          </label>
          <select id="status" name="status" defaultValue={product.status} className={inputClass}>
            <option value="DRAFT">Brouillon (non visible)</option>
            <option value="PUBLISHED">Publié</option>
            <option value="ARCHIVED">Archivé (retiré de la vente)</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="shortDescription" className="font-semibold">
          Accroche (160 caractères max.)
        </label>
        <input
          id="shortDescription"
          name="shortDescription"
          maxLength={160}
          defaultValue={product.shortDescription}
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="description" className="font-semibold">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={product.description}
          className={`${inputClass} py-2`}
        />
      </div>
      <CategoryCheckboxes categories={categories} selected={product.categorySlugs} />
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 bg-balise px-5 font-semibold text-craie disabled:opacity-60"
        >
          {pending ? "Enregistrement..." : "Enregistrer"}
        </button>
        <p role="status" className="text-sm text-foret">
          {saved ? "Modifications enregistrées." : ""}
        </p>
      </div>
    </form>
  );
}
