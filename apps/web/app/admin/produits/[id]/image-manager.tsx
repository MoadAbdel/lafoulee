"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  IMAGES_PER_PRODUCT,
  imageUploadQuerySchema,
  type AdminProductDetailDto,
} from "@lafoulee/shared";
import { FormErrors, inputClass } from "@/components/form-errors";
import { apiRequest, uploadFile } from "@/lib/client-api";

/**
 * Photos d'un produit (EA03), stockées dans Vercel Blob. La première est la photo
 * principale du catalogue. Le texte alternatif est obligatoire (RGAA, critère 1.1).
 */
export function ImageManager({ product }: { product: AdminProductDetailDto }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const full = product.images.length >= IMAGES_PER_PRODUCT;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const file = (element.elements.namedItem("file") as HTMLInputElement | null)?.files?.[0];
    const alt = imageUploadQuerySchema.safeParse({ alt: String(form.get("alt") ?? "") });
    const problems: string[] = [];
    if (!file || file.size === 0) problems.push("Choisissez une photo.");
    else if (!(IMAGE_TYPES as readonly string[]).includes(file.type))
      problems.push("Formats acceptés : JPEG, PNG, WebP.");
    else if (file.size > IMAGE_MAX_BYTES) problems.push("La photo dépasse 4 Mo.");
    if (!alt.success) problems.push(...alt.error.issues.map((issue) => issue.message));
    if (problems.length || !file || !alt.success) {
      setErrors(problems);
      return;
    }
    setPending(true);
    setErrors([]);
    const result = await uploadFile(
      `/admin/products/${product.id}/images?${new URLSearchParams({ alt: alt.data.alt })}`,
      file,
    );
    setPending(false);
    if (result.ok) {
      element.reset();
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  async function remove(imageId: string) {
    setErrors([]);
    const result = await apiRequest("DELETE", `/admin/products/${product.id}/images/${imageId}`);
    if (result.ok) router.refresh();
    else setErrors(result.error.messages);
  }

  return (
    <section aria-labelledby="titre-photos" className="space-y-3 border border-asphalte/15 bg-white p-4">
      <h2 id="titre-photos" className="font-display text-2xl font-bold uppercase">
        Photos
      </h2>
      <FormErrors messages={errors} />
      {product.images.length === 0 ? (
        <p className="text-sm">Aucune photo : le catalogue affiche une vignette avec la marque et le nom.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-3">
          {product.images.map((image, index) => (
            <li key={image.id} className="border border-asphalte/15">
              <div className="relative aspect-[4/3] bg-craie">
                <Image src={image.url} alt={image.alt} fill sizes="240px" className="object-contain p-2" />
              </div>
              <div className="space-y-2 p-2 text-sm">
                <p>
                  {index === 0 && <strong>Photo principale. </strong>}
                  {image.alt}
                </p>
                <button
                  type="button"
                  onClick={() => remove(image.id)}
                  aria-label={`Supprimer la photo : ${image.alt}`}
                  className="min-h-11 border border-balise px-3 font-semibold text-balise"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-sm">{IMAGES_PER_PRODUCT} photos au plus : supprimez-en une pour en ajouter.</p>
      ) : (
        <form onSubmit={upload} noValidate className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="image-file" className="font-semibold">
              Photo (JPEG, PNG ou WebP, 4 Mo max.)
            </label>
            <input
              id="image-file"
              name="file"
              type="file"
              accept={IMAGE_TYPES.join(",")}
              className="mt-1 block min-h-11"
            />
          </div>
          <div className="min-w-64 flex-1">
            <label htmlFor="image-alt" className="font-semibold">
              Description de la photo (pour les lecteurs d&apos;écran)
            </label>
            <input
              id="image-alt"
              name="alt"
              maxLength={160}
              placeholder="Chaussure noire vue de profil"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 bg-asphalte px-4 font-semibold text-craie disabled:opacity-60"
          >
            {pending ? "Envoi..." : "Ajouter la photo"}
          </button>
        </form>
      )}
    </section>
  );
}
