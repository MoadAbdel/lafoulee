"use client";

import { useId, useMemo, useState } from "react";
import { formatPrice, type StoreDto, type VariantDto } from "@lafoulee/shared";

/**
 * Choix du coloris puis de la pointure ou taille, et disponibilité par boutique (EF03).
 * Boutons radio natifs : utilisables au clavier et annoncés par les lecteurs d'écran.
 * Une taille en rupture partout reste visible mais n'est pas sélectionnable.
 */
export function VariantPicker({ variants, stores }: { variants: VariantDto[]; stores: StoreDto[] }) {
  const colors = useMemo(() => [...new Set(variants.map((variant) => variant.color))], [variants]);
  const [color, setColor] = useState(colors[0] ?? "");
  const sizes = variants.filter((variant) => variant.color === color);
  const [variantId, setVariantId] = useState<string | null>(null);
  const selected = sizes.find((variant) => variant.id === variantId) ?? null;
  const id = useId();

  return (
    <div className="mt-6 space-y-6">
      {colors.length > 1 && (
        <fieldset>
          <legend className="font-semibold">Coloris</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {colors.map((value) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-coloris`}
                  value={value}
                  checked={color === value}
                  onChange={() => {
                    setColor(value);
                    setVariantId(null);
                  }}
                  className="peer sr-only"
                />
                <span className="block min-h-11 content-center border border-asphalte/40 bg-white px-3 peer-checked:border-asphalte peer-checked:bg-asphalte peer-checked:text-craie peer-focus-visible:outline-3 peer-focus-visible:outline-balise">
                  {value}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="font-semibold">{sizes.some((v) => /^\d/.test(v.size)) ? "Pointure" : "Taille"}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {sizes.map((variant) => {
            const soldOut = variant.totalAvailable === 0;
            return (
              <label key={variant.id} className={soldOut ? "cursor-not-allowed" : "cursor-pointer"}>
                <input
                  type="radio"
                  name={`${id}-taille`}
                  value={variant.id}
                  disabled={soldOut}
                  aria-label={soldOut ? `${variant.size} (rupture)` : variant.size}
                  checked={variantId === variant.id}
                  onChange={() => setVariantId(variant.id)}
                  className="peer sr-only"
                />
                <span
                  className={`block min-h-11 min-w-14 content-center border px-3 text-center peer-focus-visible:outline-3 peer-focus-visible:outline-balise ${
                    soldOut
                      ? "border-asphalte/20 bg-craie text-asphalte/50 line-through"
                      : "border-asphalte/40 bg-white peer-checked:border-asphalte peer-checked:bg-asphalte peer-checked:text-craie"
                  }`}
                >
                  {variant.size}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-live="polite">
        {selected ? (
          <div>
            <p className="font-semibold">
              Disponibilité en {selected.size}, {selected.color.toLowerCase()} ({formatPrice(selected.priceCents)})
            </p>
            <ul className="mt-2 divide-y divide-asphalte/10 border border-asphalte/15 bg-white">
              {stores.map((store) => {
                const available = selected.stocks.find((stock) => stock.storeSlug === store.slug)?.available ?? 0;
                return (
                  <li key={store.slug} className="flex justify-between gap-4 px-3 py-2">
                    <span>{store.name}</span>
                    <span className={available > 0 ? "font-semibold text-foret" : "text-asphalte/70"}>
                      {available > 0 ? `${available} en stock` : "Indisponible"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-asphalte/80">Choisissez une taille pour voir le stock de chaque boutique.</p>
        )}
      </div>

      <button
        type="button"
        disabled
        className="min-h-12 w-full cursor-not-allowed bg-asphalte/40 px-6 font-semibold text-craie"
      >
        Ajout au panier bientôt disponible
      </button>
    </div>
  );
}
