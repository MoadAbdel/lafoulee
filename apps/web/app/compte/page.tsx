import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { formatPrice, type OrderDto } from "@lafoulee/shared";
import { getMyOrders, getSession } from "@/lib/session";
import { LogoutButton } from "./logout-button";
import { MyData } from "./my-data";
import { RefreshSession } from "./refresh-session";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Suspense fallback={<p>Chargement...</p>}>
        <Account />
      </Suspense>
    </div>
  );
}

async function Account() {
  const session = await getSession();
  if (session.status === "anonymous") redirect("/connexion");
  // Jeton d'accès expiré : le navigateur renouvelle la session puis recharge la page.
  if (session.status === "expired") return <RefreshSession />;

  const { user } = session;
  return (
    <>
      <h1 className="font-display tracking-tight text-4xl font-extrabold">
        Bonjour{user.firstName ? ` ${user.firstName}` : ""}
      </h1>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border border-asphalte/15 bg-white p-4">
        <dt className="font-semibold">Email</dt>
        <dd>{user.email}</dd>
        <dt className="font-semibold">Profil</dt>
        <dd>{user.role === "ADMIN" ? "Administrateur" : "Client"}</dd>
      </dl>
      {user.role === "ADMIN" && (
        <Link
          href="/admin"
          className="mt-6 inline-block min-h-11 content-center bg-asphalte px-5 font-semibold text-craie"
        >
          Accéder au back-office
        </Link>
      )}
      <OrderHistory orders={await getMyOrders()} />
      {user.role !== "ADMIN" && <MyData />}
      <div className="mt-8 max-w-xs">
        <LogoutButton />
      </div>
    </>
  );
}

const STATUS_LABELS: Record<OrderDto["status"], string> = {
  PENDING: "En attente de paiement",
  PAID: "Payée",
  READY_FOR_PICKUP: "Prête en boutique",
  SHIPPED: "Expédiée",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
};

function OrderHistory({ orders }: { orders: OrderDto[] }) {
  return (
    <section aria-labelledby="titre-commandes" className="mt-8">
      <h2 id="titre-commandes" className="font-display tracking-tight text-3xl font-extrabold">
        Mes commandes
      </h2>
      {orders.length === 0 ? (
        <p className="mt-2 text-asphalte/80">Aucune commande pour le moment.</p>
      ) : (
        <ul className="mt-3 divide-y divide-asphalte/10 border border-asphalte/15 bg-white">
          {orders.map((order) => (
            <li key={order.id} className="p-4">
              <p className="flex flex-wrap justify-between gap-2 font-semibold">
                <span>
                  Commande n°{order.number} du {new Date(order.createdAt).toLocaleDateString("fr-FR")}
                </span>
                <span>{formatPrice(order.totalCents)}</span>
              </p>
              <p className="text-sm text-asphalte/80">
                {STATUS_LABELS[order.status]}
                {order.pickupStoreName ? ` : retrait à ${order.pickupStoreName}` : " : livraison"}
              </p>
              <ul className="mt-1 text-sm">
                {order.lines.map((line, index) => (
                  <li key={index}>
                    {line.quantity} x {line.productName} ({line.variantLabel})
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
