"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  formatPrice,
  MAX_QUANTITY_PER_LINE,
  type CartDto,
  type CartLineDto,
} from "@lafoulee/shared";
import { FormErrors } from "@/components/form-errors";
import { getJson, notifyCartChanged, putJson } from "@/lib/client-api";

export function CartView() {
  const [cart, setCart] = useState<CartDto | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    void getJson<CartDto>("/cart").then((result) => {
      if (result.ok) setCart(result.data);
      else setErrors(result.error.messages);
    });
  }, []);

  async function update(line: CartLineDto, quantity: number) {
    setErrors([]);
    const result = await putJson<CartDto>("/cart/items", { variantId: line.variantId, quantity });
    if (result.ok) {
      setCart(result.data);
      notifyCartChanged();
    } else {
      setErrors(result.error.messages);
    }
  }

  if (!cart)
    return <p className="mt-6">{errors.length ? <FormErrors messages={errors} /> : "Chargement du panier..."}</p>;

  if (cart.lines.length === 0) {
    return (
      <div className="mt-6">
        <p>Votre panier est vide.</p>
        <Link href="/produits" className="mt-4 inline-block font-semibold underline underline-offset-4">
          Voir le catalogue
        </Link>
      </div>
    );
  }

  const missing = FREE_SHIPPING_THRESHOLD_CENTS - cart.subtotalCents;
  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div>
        <FormErrors messages={errors} />
        <ul className="divide-y divide-asphalte/10 border border-asphalte/15 bg-white">
          {cart.lines.map((line) => {
            const max = Math.min(MAX_QUANTITY_PER_LINE, Math.max(line.available, line.quantity));
            return (
              <li key={line.variantId} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-48 flex-1">
                  <Link
                    href={`/produits/${line.productSlug}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {line.brand} {line.productName}
                  </Link>
                  <p className="text-sm text-asphalte/80">
                    {line.size}, {line.color} : {formatPrice(line.unitPriceCents)}
                  </p>
                </div>
                <label className="text-sm">
                  <span className="sr-only">
                    Quantité pour {line.productName} {line.size}
                  </span>
                  <select
                    value={line.quantity}
                    onChange={(event) => void update(line, Number(event.target.value))}
                    className="min-h-11 border border-asphalte/40 bg-white px-2"
                  >
                    {Array.from({ length: max }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="w-24 text-right font-semibold">{formatPrice(line.lineTotalCents)}</p>
                <button
                  type="button"
                  onClick={() => void update(line, 0)}
                  aria-label={`Retirer ${line.productName} ${line.size} du panier`}
                  className="min-h-11 text-sm underline underline-offset-4"
                >
                  Retirer
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="h-fit border border-asphalte/15 bg-white p-4" aria-label="Récapitulatif">
        <p className="flex justify-between">
          <span>Sous-total</span>
          <span className="font-semibold">{formatPrice(cart.subtotalCents)}</span>
        </p>
        <p className="mt-2 text-sm text-asphalte/80">Retrait en boutique gratuit.</p>
        <p className="mt-1 text-sm text-asphalte/80">
          {missing > 0
            ? `Livraison offerte dès ${formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)} : plus que ${formatPrice(missing)}.`
            : "Livraison offerte."}
        </p>
        <Link
          href="/commande"
          className="mt-4 block min-h-12 content-center bg-balise px-6 text-center font-semibold text-craie hover:bg-balise/90"
        >
          Commander
        </Link>
      </aside>
    </div>
  );
}
