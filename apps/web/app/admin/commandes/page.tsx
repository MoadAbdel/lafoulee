import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  adminOrderQuerySchema,
  formatPrice,
  type AdminListDto,
  type AdminOrderDto,
  type AdminOrderQuery,
} from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { STATUS_LABELS } from "../status-labels";
import { OrderActions } from "./order-actions";

export const metadata: Metadata = { title: "Commandes" };

const FILTERS: (AdminOrderQuery["statut"] | undefined)[] = [
  undefined,
  "PAID",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "COMPLETED",
  "PENDING",
  "CANCELLED",
  "REFUNDED",
];

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin/commandes">) {
  return (
    <>
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Commandes</h1>
      <Suspense fallback={<p className="mt-4">Chargement des commandes...</p>}>
        <Orders searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Orders({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const parsed = adminOrderQuerySchema.safeParse({ statut: raw.statut || undefined, page: raw.page ?? 1 });
  const query: AdminOrderQuery = parsed.success ? parsed.data : { page: 1 };
  const params = new URLSearchParams({ page: String(query.page) });
  if (query.statut) params.set("statut", query.statut);
  const list = await adminGet<AdminListDto<AdminOrderDto>>(`/orders?${params}`);

  const link = (changes: Partial<AdminOrderQuery>) => {
    const next = { ...query, ...changes };
    const qs = new URLSearchParams();
    if (next.statut) qs.set("statut", next.statut);
    if (next.page > 1) qs.set("page", String(next.page));
    return `/admin/commandes${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <div className="mt-4 space-y-4">
      <nav aria-label="Filtrer par statut">
        <ul className="flex flex-wrap gap-2 text-sm">
          {FILTERS.map((status) => (
            <li key={status ?? "toutes"}>
              <Link
                href={link({ statut: status, page: 1 })}
                aria-current={query.statut === status ? "page" : undefined}
                className={`block min-h-11 content-center border px-3 ${query.statut === status ? "border-asphalte bg-asphalte text-craie" : "border-asphalte/30 bg-white"}`}
              >
                {status ? STATUS_LABELS[status] : "Toutes"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p role="status" className="text-sm text-asphalte/80">
        {list.total} commande{list.total > 1 ? "s" : ""}
      </p>
      <ul className="space-y-3">
        {list.items.map((order) => (
          <li key={order.id} id={`commande-${order.number}`} className="border border-asphalte/15 bg-white p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold">
                N°{order.number} du {new Date(order.createdAt).toLocaleString("fr-FR")} :{" "}
                {formatPrice(order.totalCents)}
              </p>
              <p>{STATUS_LABELS[order.status]}</p>
            </div>
            <p className="text-sm text-asphalte/80">
              {order.customerEmail} :{" "}
              {order.pickupStoreName
                ? `retrait à ${order.pickupStoreName}`
                : `livraison, ${order.shippingAddress?.fullName}, ${order.shippingAddress?.line1}, ${order.shippingAddress?.postalCode} ${order.shippingAddress?.city}`}
            </p>
            <ul className="mt-1 text-sm">
              {order.lines.map((line, index) => (
                <li key={index}>
                  {line.quantity} x {line.productName} ({line.variantLabel})
                </li>
              ))}
            </ul>
            <OrderActions order={order} />
          </li>
        ))}
      </ul>
      {list.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-4">
          {query.page > 1 && (
            <Link href={link({ page: query.page - 1 })} className="underline underline-offset-4">
              Page précédente
            </Link>
          )}
          <span>
            Page {query.page} sur {list.totalPages}
          </span>
          {query.page < list.totalPages && (
            <Link href={link({ page: query.page + 1 })} className="underline underline-offset-4">
              Page suivante
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
