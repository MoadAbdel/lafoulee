import type { AdminCategoryDto } from "@lafoulee/shared";

/** "119,90" ou "119.9" donne 11990 centimes ; NaN si la saisie n'est pas un prix. */
export function parsePriceCents(value: FormDataEntryValue | null): number {
  const text = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

/** Catégories cochées dans un formulaire (champ "categories"). */
export function checkedCategories(form: FormData): string[] {
  return form.getAll("categories").map(String);
}

/** Cases à cocher des catégories d'un produit (au moins une, cinq au plus). */
export function CategoryCheckboxes({
  categories,
  selected = [],
}: {
  categories: AdminCategoryDto[];
  selected?: string[];
}) {
  return (
    <fieldset>
      <legend className="font-semibold">Catégories</legend>
      <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
        {categories.map((category) => (
          <label key={category.slug} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              name="categories"
              value={category.slug}
              defaultChecked={selected.includes(category.slug)}
            />
            {category.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
