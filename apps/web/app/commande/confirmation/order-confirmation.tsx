"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPrice, type OrderDto } from "@lafoulee/shared";
import { FormErrors } from "@/components/form-errors";
import { deleteJson, getJson, notifyCartChanged } from "@/lib/client-api";

const POLL_MS = 2000;
const MAX_POLLS = 15;

/**
 * Après le paiement, Stripe redirige ici. On interroge l'état de la commande
 * (l'API vérifie auprès de Stripe si le webhook n'est pas encore arrivé),
 * puis on vide le panier une fois la commande payée.
 */
export function OrderConfirmation() {
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("commande");
    const token = params.get("jeton");
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const poll = async () => {
      if (!id || !token) {
        setErrors(["Lien de suivi incomplet."]);
        return;
      }
      const result = await getJson<OrderDto>(`/orders/${encodeURIComponent(id)}?jeton=${encodeURIComponent(token)}`);
      if (stopped) return;
      if (!result.ok) {
        setErrors(result.error.status === 404 ? ["Commande introuvable."] : result.error.messages);
        return;
      }
      setOrder(result.data);
      if (result.data.status === "PENDING") {
        if (++polls < MAX_POLLS) timer = setTimeout(() => void poll(), POLL_MS);
        else setGaveUp(true);
      } else if (result.data.status === "PAID") {
        await deleteJson("/cart");
        notifyCartChanged();
      }
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  if (errors.length)
    return (
      <div className="mt-6">
        <FormErrors messages={errors} />
      </div>
    );
  if (!order) return <p className="mt-6">Vérification du paiement...</p>;

  return (
    <div className="mt-6 space-y-6">
      <div
        role="status"
        className={`border-l-4 bg-white p-4 ${order.status === "PAID" ? "border-foret" : "border-balise"}`}
      >
        {order.status === "PAID" ? (
          <>
            <p className="text-lg font-semibold">Merci, la commande n°{order.number} est payée.</p>
            <p className="mt-1">
              {order.pickupStoreName
                ? `Retrait gratuit à ${order.pickupStoreName}. Nous vous écrivons dès qu'elle est prête.`
                : "Vous recevrez un email à l'expédition."}{" "}
              Un email de confirmation vient de partir.
            </p>
          </>
        ) : order.status === "PENDING" ? (
          <p>
            {gaveUp
              ? "Le paiement n'est pas encore confirmé. Si vous avez été débité, la commande sera validée sous peu : vous recevrez un email."
              : "Paiement en cours de confirmation..."}
          </p>
        ) : (
          <p>Cette commande a été annulée. Aucun montant n&apos;a été prélevé.</p>
        )}
      </div>

      <section aria-labelledby="titre-detail">
        <h2 id="titre-detail" className="font-display tracking-tight text-2xl font-extrabold">
          Détail
        </h2>
        <ul className="mt-2 divide-y divide-asphalte/10 border border-asphalte/15 bg-white">
          {order.lines.map((line, index) => (
            <li key={index} className="flex justify-between gap-4 p-3">
              <span>
                {line.quantity} x {line.productName} ({line.variantLabel})
              </span>
              <span>{formatPrice(line.unitPriceCents * line.quantity)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-right">
          Frais de port : {order.shippingCents === 0 ? "offerts" : formatPrice(order.shippingCents)}
          <br />
          <strong>Total : {formatPrice(order.totalCents)}</strong>
        </p>
      </section>
      <Link href="/produits" className="inline-block font-semibold underline underline-offset-4">
        Continuer mes achats
      </Link>
    </div>
  );
}
