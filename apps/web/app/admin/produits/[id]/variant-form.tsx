"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { variantCreateSchema } from "@lafoulee/shared";
import { FormErrors, inputClass } from "@/components/form-errors";
import { postJson } from "@/lib/client-api";

/** Ajout d'une taille dans un coloris (EA03). Son stock démarre à 0 dans chaque boutique. */
export function VariantForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const parsed = variantCreateSchema.safeParse({
      size: String(form.get("size") ?? ""),
      color: String(form.get("color") ?? ""),
    });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    setPending(true);
    setErrors([]);
    const result = await postJson(`/admin/products/${productId}/variants`, parsed.data);
    setPending(false);
    if (result.ok) {
      setMessage(`Taille ${parsed.data.size} (${parsed.data.color}) ajoutée. Saisissez son stock ci-dessous.`);
      (element.elements.namedItem("size") as HTMLInputElement).value = "";
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby="titre-variante"
      className="space-y-3 border border-asphalte/15 bg-white p-4"
    >
      <h2 id="titre-variante" className="font-display text-2xl font-bold uppercase">
        Ajouter une taille
      </h2>
      <FormErrors messages={errors} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="variant-size" className="font-semibold">
            Taille
          </label>
          <input id="variant-size" name="size" placeholder="42 ou M" className={inputClass} />
        </div>
        <div>
          <label htmlFor="variant-color" className="font-semibold">
            Coloris
          </label>
          <input id="variant-color" name="color" placeholder="Noir" className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 bg-asphalte px-4 font-semibold text-craie disabled:opacity-60"
        >
          {pending ? "Ajout..." : "Ajouter"}
        </button>
      </div>
      <p role="status" className="text-sm text-foret">
        {message}
      </p>
    </form>
  );
}
