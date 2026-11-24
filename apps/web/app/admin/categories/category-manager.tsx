"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  type AdminCategoryDto,
  type CategoryUpdateInput,
} from "@lafoulee/shared";
import { FormErrors, inputClass } from "@/components/form-errors";
import { apiRequest, postJson } from "@/lib/client-api";

function readFields(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    description: String(form.get("description") ?? ""),
    position: Number(form.get("position") ?? 0),
  };
}

/** Création, modification et suppression des catégories (EA03). */
export function CategoryManager({ categories }: { categories: AdminCategoryDto[] }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const parsed = categoryCreateSchema.safeParse(readFields(new FormData(element)));
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setErrors([]);
    const result = await postJson<AdminCategoryDto>("/admin/categories", parsed.data);
    if (result.ok) {
      element.reset();
      setMessage(`Catégorie "${result.data.name}" créée.`);
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  async function update(category: AdminCategoryDto, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = readFields(new FormData(event.currentTarget));
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([key, value]) => category[key as keyof AdminCategoryDto] !== value),
    );
    const parsed = categoryUpdateSchema.safeParse(changes);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setErrors([]);
    const result = await apiRequest("PATCH", `/admin/categories/${category.id}`, parsed.data as CategoryUpdateInput);
    if (result.ok) {
      setMessage(`Catégorie "${fields.name}" enregistrée.`);
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  async function remove(category: AdminCategoryDto) {
    setErrors([]);
    const result = await apiRequest("DELETE", `/admin/categories/${category.id}`);
    if (result.ok) {
      setMessage(`Catégorie "${category.name}" supprimée.`);
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  return (
    <div className="mt-4 space-y-6">
      <FormErrors messages={errors} />
      <p role="status" className="text-sm text-foret">
        {message}
      </p>
      <ul className="space-y-3">
        {categories.map((category) => (
          <li key={category.id} className="border border-asphalte/15 bg-white p-4">
            <form onSubmit={(event) => update(category, event)} noValidate className="space-y-3">
              <p className="text-sm text-asphalte/80">
                /produits?categorie={category.slug} : {category.productCount} produit
                {category.productCount > 1 ? "s" : ""}
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                <div>
                  <label htmlFor={`name-${category.id}`} className="font-semibold">
                    Nom
                  </label>
                  <input id={`name-${category.id}`} name="name" defaultValue={category.name} className={inputClass} />
                </div>
                <div>
                  <label htmlFor={`position-${category.id}`} className="font-semibold">
                    Ordre
                  </label>
                  <input
                    id={`position-${category.id}`}
                    name="position"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={category.position}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor={`description-${category.id}`} className="font-semibold">
                  Description
                </label>
                <input
                  id={`description-${category.id}`}
                  name="description"
                  defaultValue={category.description}
                  className={inputClass}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="min-h-11 bg-asphalte px-4 font-semibold text-craie">
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => remove(category)}
                  disabled={category.productCount > 0}
                  aria-label={`Supprimer la catégorie ${category.name}`}
                  className="min-h-11 border border-balise px-4 font-semibold text-balise disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </form>
          </li>
        ))}
      </ul>
      <form
        onSubmit={create}
        noValidate
        aria-labelledby="titre-nouvelle-categorie"
        className="space-y-3 border border-asphalte/15 bg-white p-4"
      >
        <h2 id="titre-nouvelle-categorie" className="font-display text-2xl font-bold uppercase">
          Nouvelle catégorie
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <div>
            <label htmlFor="new-category-name" className="font-semibold">
              Nom
            </label>
            <input id="new-category-name" name="name" className={inputClass} />
          </div>
          <div>
            <label htmlFor="new-category-position" className="font-semibold">
              Ordre
            </label>
            <input
              id="new-category-position"
              name="position"
              type="number"
              min={0}
              max={100}
              defaultValue={categories.length}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="new-category-description" className="font-semibold">
            Description
          </label>
          <input id="new-category-description" name="description" className={inputClass} />
        </div>
        <button type="submit" className="min-h-11 bg-balise px-5 font-semibold text-craie">
          Créer la catégorie
        </button>
      </form>
    </div>
  );
}
