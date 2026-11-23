"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminProductDetailDto } from "@lafoulee/shared";
import { FormErrors } from "@/components/form-errors";
import { apiRequest } from "@/lib/client-api";

/**
 * Stock par variante et par boutique (EA04). Chaque cellule s'enregistre seule.
 * Le stock réservé (paiements en cours) est affiché : on ne peut pas descendre en dessous.
 */
export function StockGrid({ product }: { product: AdminProductDetailDto }) {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function save(variantId: string, storeSlug: string, value: string) {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999) {
      setErrors(["Le stock est un nombre entier entre 0 et 9999."]);
      return;
    }
    const cell = `${variantId}-${storeSlug}`;
    setSaving(cell);
    setErrors([]);
    const result = await apiRequest("PUT", "/admin/stocks", { variantId, storeSlug, quantity });
    setSaving(null);
    if (result.ok) {
      setMessage("Stock enregistré.");
      router.refresh();
    } else {
      setErrors(result.error.messages);
    }
  }

  return (
    <section aria-labelledby="titre-stock" className="space-y-3 border border-asphalte/15 bg-white p-4">
      <h2 id="titre-stock" className="font-display text-2xl font-bold uppercase">
        Stock par boutique
      </h2>
      <FormErrors messages={errors} />
      <p role="status" className="min-h-5 text-sm text-foret">
        {message}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Stock de chaque variante dans chaque boutique</caption>
          <thead className="bg-craie">
            <tr>
              <th scope="col" className="p-2">
                Variante
              </th>
              {product.stores.map((store) => (
                <th key={store.slug} scope="col" className="p-2">
                  {store.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <tr key={variant.id} className="border-t border-asphalte/10">
                <th scope="row" className="p-2 font-normal">
                  {variant.size}, {variant.color}
                </th>
                {product.stores.map((store) => {
                  const stock = variant.stocks.find((item) => item.storeSlug === store.slug);
                  const id = `stock-${variant.id}-${store.slug}`;
                  const low = stock ? stock.quantity - stock.reserved <= stock.alertThreshold : true;
                  return (
                    <td key={store.slug} className="p-2">
                      <label htmlFor={id} className="sr-only">
                        Stock {variant.size} {variant.color} à {store.name}
                      </label>
                      <input
                        id={id}
                        type="number"
                        min={stock?.reserved ?? 0}
                        max={9999}
                        defaultValue={stock?.quantity ?? 0}
                        disabled={saving === `${variant.id}-${store.slug}`}
                        onBlur={(event) => {
                          if (Number(event.target.value) !== (stock?.quantity ?? 0))
                            void save(variant.id, store.slug, event.target.value);
                        }}
                        aria-describedby={stock?.reserved ? `${id}-res` : undefined}
                        className={`min-h-11 w-20 border px-2 ${low ? "border-balise" : "border-asphalte/40"}`}
                      />
                      {stock && stock.reserved > 0 && (
                        <span id={`${id}-res`} className="ml-1 text-xs text-asphalte/70">
                          dont {stock.reserved} réservé{stock.reserved > 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-asphalte/70">
        Cadre orange : stock sous le seuil d&apos;alerte. Le stock s&apos;enregistre en quittant le champ.
      </p>
    </section>
  );
}
