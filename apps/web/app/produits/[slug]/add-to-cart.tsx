"use client";

import Link from "next/link";
import { useState } from "react";
import type { CartDto } from "@lafoulee/shared";
import { FormErrors } from "@/components/form-errors";
import { getJson, notifyCartChanged, putJson } from "@/lib/client-api";

/** Ajoute une unité de la variante choisie au panier (quantité totale envoyée à l'API). */
export function AddToCart({ variantId, disabled }: { variantId: string | null; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function add() {
    if (!variantId) return;
    setPending(true);
    setErrors([]);
    const cart = await getJson<CartDto>("/cart");
    const current = cart.ok ? (cart.data.lines.find((line) => line.variantId === variantId)?.quantity ?? 0) : 0;
    const result = await putJson<CartDto>("/cart/items", { variantId, quantity: current + 1 });
    setPending(false);
    if (result.ok) {
      setAdded(true);
      notifyCartChanged();
    } else {
      setErrors(result.error.messages);
    }
  }

  return (
    <div className="space-y-3">
      <FormErrors messages={errors} />
      <button
        type="button"
        onClick={add}
        disabled={disabled || pending}
        className="min-h-12 w-full bg-balise px-6 font-semibold text-craie hover:bg-balise/90 disabled:cursor-not-allowed disabled:bg-asphalte/40"
      >
        {pending ? "Ajout..." : disabled ? "Choisissez une taille" : "Ajouter au panier"}
      </button>
      <p role="status" className="min-h-6 text-sm">
        {added && (
          <>
            Article ajouté.{" "}
            <Link href="/panier" className="font-semibold underline underline-offset-4">
              Voir le panier
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
