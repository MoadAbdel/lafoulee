"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatPrice, type AdminOrderDto } from "@lafoulee/shared";
import { FormErrors } from "@/components/form-errors";
import { apiRequest } from "@/lib/client-api";
import { ACTION_LABELS } from "../status-labels";

/** Actions sur une commande : changement de statut et remboursement (avec confirmation explicite). */
export function OrderActions({ order }: { order: AdminOrderDto }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const dialog = useRef<HTMLDialogElement>(null);

  async function run(method: "PATCH" | "POST", path: string, body?: unknown) {
    setPending(true);
    setErrors([]);
    const result = await apiRequest(method, path, body);
    setPending(false);
    if (result.ok) router.refresh();
    else setErrors(result.error.messages);
  }

  if (order.nextStatuses.length === 0 && !order.refundable) return null;

  return (
    <div className="mt-3 space-y-2">
      <FormErrors messages={errors} />
      <div className="flex flex-wrap gap-2">
        {order.nextStatuses.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending}
            onClick={() => void run("PATCH", `/admin/orders/${order.id}/status`, { status })}
            className="min-h-11 bg-asphalte px-4 text-sm font-semibold text-craie disabled:opacity-60"
          >
            {ACTION_LABELS[status] ?? status}
          </button>
        ))}
        {order.refundable && (
          <button
            type="button"
            disabled={pending}
            onClick={() => dialog.current?.showModal()}
            className="min-h-11 border border-balise px-4 text-sm font-semibold text-balise disabled:opacity-60"
          >
            Rembourser
          </button>
        )}
      </div>
      {/* <dialog> natif : focus piégé et touche Échap gérés par le navigateur (TF14). */}
      <dialog ref={dialog} aria-labelledby={`remb-${order.id}`} className="max-w-md p-6 backdrop:bg-asphalte/60">
        <h2 id={`remb-${order.id}`} className="font-display tracking-tight text-2xl font-extrabold">
          Rembourser la commande n°{order.number} ?
        </h2>
        <p className="mt-2">
          {formatPrice(order.totalCents)} seront remboursés au client par Stripe et les articles reviendront en stock.
          Cette action est définitive et journalisée.
        </p>
        <form method="dialog" className="mt-4 flex gap-2">
          <button type="submit" className="min-h-11 border border-asphalte px-4 font-semibold">
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              dialog.current?.close();
              void run("POST", `/admin/orders/${order.id}/refund`);
            }}
            className="min-h-11 bg-balise px-4 font-semibold text-craie"
          >
            Confirmer le remboursement
          </button>
        </form>
      </dialog>
    </div>
  );
}
