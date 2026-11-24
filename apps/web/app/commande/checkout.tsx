"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  checkoutSchema,
  computeTotals,
  formatPrice,
  type CartDto,
  type CreateOrderResult,
  type FulfillmentMode,
  type SessionUser,
  type StoreDto,
} from "@lafoulee/shared";
import { buttonClass, FormErrors, inputClass } from "@/components/form-errors";
import { getJson, postJson } from "@/lib/client-api";
import { AddressAutocomplete } from "./address-autocomplete";
import { PaymentStep } from "./payment-step";

interface Context {
  cart: CartDto;
  stores: StoreDto[];
  user: SessionUser | null;
}

/** Tunnel en 2 étapes : retrait ou livraison, puis paiement (dossier, C6 et C15). */
export function Checkout() {
  const [context, setContext] = useState<Context | null>(null);
  const [fulfillment, setFulfillment] = useState<FulfillmentMode>("PICKUP");
  const [storeSlug, setStoreSlug] = useState("");
  const [address, setAddress] = useState({ fullName: "", line1: "", line2: "", postalCode: "", city: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [order, setOrder] = useState<CreateOrderResult | null>(null);

  useEffect(() => {
    void Promise.all([
      getJson<CartDto>("/cart"),
      getJson<StoreDto[]>("/stores"),
      getJson<SessionUser>("/auth/me"),
    ]).then(([cart, stores, me]) => {
      if (!cart.ok || !stores.ok) {
        setErrors(["Le catalogue est momentanément indisponible. Réessayez."]);
        return;
      }
      setContext({ cart: cart.data, stores: stores.data, user: me.ok ? me.data : null });
      const pickup = stores.data.filter((store) => cart.data.pickupStoreSlugs.includes(store.slug));
      setStoreSlug((current) => (pickup.some((store) => store.slug === current) ? current : (pickup[0]?.slug ?? "")));
      if (pickup.length === 0) setFulfillment("DELIVERY"); // aucune boutique n'a tout le panier
    });
  }, []);

  if (!context)
    return <div className="mt-6">{errors.length ? <FormErrors messages={errors} /> : <p>Chargement...</p>}</div>;
  if (context.cart.lines.length === 0) {
    return (
      <p className="mt-6">
        Votre panier est vide.{" "}
        <Link href="/produits" className="font-semibold underline underline-offset-4">
          Voir le catalogue
        </Link>
      </p>
    );
  }

  const totals = computeTotals(context.cart.subtotalCents, fulfillment);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim() || undefined;
    const input =
      fulfillment === "PICKUP"
        ? { fulfillment, pickupStoreSlug: storeSlug, email }
        : { fulfillment, address: { ...address, line2: address.line2.trim() || undefined }, email };
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }
    if (!context?.user && !parsed.data.email) {
      setErrors(["Indiquez une adresse email pour recevoir la confirmation."]);
      return;
    }
    setPending(true);
    setErrors([]);
    const result = await postJson<CreateOrderResult>("/orders", parsed.data);
    setPending(false);
    if (result.ok) setOrder(result.data);
    else setErrors(result.error.messages);
  }

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-foret" aria-live="polite">
          Étape {order ? 2 : 1} sur 2 : {order ? "paiement" : "retrait ou livraison"}
        </p>

        {order ? (
          <PaymentStep order={order} />
        ) : (
          <form onSubmit={submit} noValidate className="mt-4 space-y-6">
            <FormErrors messages={errors} />
            <fieldset className="space-y-3">
              <legend className="font-semibold">Mode de réception</legend>
              <label className="flex min-h-11 items-center gap-3 border border-asphalte/30 bg-white px-3">
                <input
                  type="radio"
                  name="fulfillment"
                  checked={fulfillment === "PICKUP"}
                  onChange={() => setFulfillment("PICKUP")}
                  disabled={context.cart.pickupStoreSlugs.length === 0}
                />
                {context.cart.pickupStoreSlugs.length === 0
                  ? "Retrait en boutique indisponible : aucune boutique n'a tout le panier en stock"
                  : "Retrait gratuit en boutique"}
              </label>
              <label className="flex min-h-11 items-center gap-3 border border-asphalte/30 bg-white px-3">
                <input
                  type="radio"
                  name="fulfillment"
                  checked={fulfillment === "DELIVERY"}
                  onChange={() => setFulfillment("DELIVERY")}
                />
                Livraison à domicile
              </label>
            </fieldset>

            {fulfillment === "PICKUP" ? (
              <div>
                <label htmlFor="store" className="font-semibold">
                  Boutique de retrait
                </label>
                <select
                  id="store"
                  value={storeSlug}
                  onChange={(event) => setStoreSlug(event.target.value)}
                  className={inputClass}
                >
                  {context.stores.map((store) => {
                    const available = context.cart.pickupStoreSlugs.includes(store.slug);
                    return (
                      <option key={store.slug} value={store.slug} disabled={!available}>
                        {store.name}, {store.address}
                        {available ? ` (${store.openingHours})` : " : pas tout le panier en stock"}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : (
              <fieldset className="space-y-4">
                <legend className="font-semibold">Adresse de livraison</legend>
                <div>
                  <label htmlFor="fullName">Nom complet</label>
                  <input
                    id="fullName"
                    autoComplete="name"
                    value={address.fullName}
                    onChange={(event) => setAddress({ ...address, fullName: event.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="line1">Adresse</label>
                  <AddressAutocomplete
                    value={address.line1}
                    onChange={(line1) => setAddress({ ...address, line1 })}
                    onSelect={(suggestion) =>
                      setAddress({
                        ...address,
                        line1: suggestion.line1,
                        postalCode: suggestion.postalCode,
                        city: suggestion.city,
                      })
                    }
                    inputClassName={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="line2">Complément (facultatif)</label>
                  <input
                    id="line2"
                    autoComplete="address-line2"
                    value={address.line2}
                    onChange={(event) => setAddress({ ...address, line2: event.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-[8rem_1fr] gap-3">
                  <div>
                    <label htmlFor="postalCode">Code postal</label>
                    <input
                      id="postalCode"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={address.postalCode}
                      onChange={(event) => setAddress({ ...address, postalCode: event.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="city">Ville</label>
                    <input
                      id="city"
                      autoComplete="address-level2"
                      value={address.city}
                      onChange={(event) => setAddress({ ...address, city: event.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {context.user ? (
              <p className="text-sm">
                La confirmation sera envoyée à <strong>{context.user.email}</strong>.
              </p>
            ) : (
              <div>
                <label htmlFor="email" className="font-semibold">
                  Email pour la confirmation
                </label>
                <input id="email" name="email" type="email" autoComplete="email" className={inputClass} />
                <p className="mt-1 text-sm text-asphalte/80">
                  Commande sans compte possible.{" "}
                  <Link prefetch={false} href="/connexion" className="underline underline-offset-4">
                    Se connecter
                  </Link>
                </p>
              </div>
            )}

            <button type="submit" disabled={pending} className={buttonClass}>
              {pending ? "Réservation de vos articles..." : "Continuer vers le paiement"}
            </button>
          </form>
        )}
      </div>

      <aside className="h-fit border border-asphalte/15 bg-white p-4" aria-label="Récapitulatif">
        <ul className="space-y-2 text-sm">
          {context.cart.lines.map((line) => (
            <li key={line.variantId} className="flex justify-between gap-3">
              <span>
                {line.quantity} x {line.productName} ({line.size})
              </span>
              <span>{formatPrice(line.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1 border-t border-asphalte/15 pt-3">
          <div className="flex justify-between">
            <dt>Frais de port</dt>
            <dd>{totals.shippingCents === 0 ? "Offerts" : formatPrice(totals.shippingCents)}</dd>
          </div>
          <div className="flex justify-between text-lg font-semibold">
            <dt>Total</dt>
            <dd>{formatPrice(order?.totalCents ?? totals.totalCents)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
