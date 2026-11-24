import Link from "next/link";
import { Suspense } from "react";
import { formatPrice, type DashboardDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { STATUS_LABELS } from "./status-labels";

export default function AdminDashboardPage() {
  return (
    <>
      <h1 className="font-display tracking-tight text-4xl font-extrabold">Tableau de bord</h1>
      <Suspense fallback={<p className="mt-4">Chargement des chiffres...</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  const data = await adminGet<DashboardDto>("/dashboard");
  const tiles = [
    { label: "Chiffre d'affaires du jour", value: formatPrice(data.revenueTodayCents) },
    { label: "Chiffre d'affaires du mois", value: formatPrice(data.revenueMonthCents) },
    { label: "Commandes à traiter", value: String(data.ordersToProcess), href: "/admin/commandes?statut=PAID" },
    { label: "Stocks bas", value: String(data.lowStockCount) },
    { label: "Paiements en attente", value: String(data.pendingPayments), href: "/admin/commandes?statut=PENDING" },
  ];

  return (
    <div className="mt-6 space-y-8">
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="border border-asphalte/15 bg-white p-4">
            <dt className="text-sm text-asphalte/80">{tile.label}</dt>
            <dd className="mt-1 font-display tracking-tight text-3xl font-extrabold">
              {tile.href ? (
                <Link href={tile.href} className="underline-offset-4 hover:underline">
                  {tile.value}
                </Link>
              ) : (
                tile.value
              )}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="titre-a-traiter">
        <h2 id="titre-a-traiter" className="font-display tracking-tight text-2xl font-extrabold">
          Commandes à traiter
        </h2>
        {data.recentOrders.length === 0 ? (
          <p className="mt-2 text-asphalte/80">Aucune commande en attente de préparation.</p>
        ) : (
          <table className="mt-2 w-full border border-asphalte/15 bg-white text-left text-sm">
            <thead className="bg-craie">
              <tr>
                <th scope="col" className="p-2">
                  N°
                </th>
                <th scope="col" className="p-2">
                  Client
                </th>
                <th scope="col" className="p-2">
                  Mode
                </th>
                <th scope="col" className="p-2 text-right">
                  Montant
                </th>
                <th scope="col" className="p-2">
                  Statut
                </th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id} className="border-t border-asphalte/10">
                  <td className="p-2">
                    <Link href={`/admin/commandes#commande-${order.number}`} className="underline underline-offset-4">
                      {order.number}
                    </Link>
                  </td>
                  <td className="p-2">{order.customerEmail}</td>
                  <td className="p-2">{order.pickupStoreName ? `Retrait ${order.pickupStoreName}` : "Livraison"}</td>
                  <td className="p-2 text-right">{formatPrice(order.totalCents)}</td>
                  <td className="p-2">{STATUS_LABELS[order.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="titre-stocks">
        <h2 id="titre-stocks" className="font-display tracking-tight text-2xl font-extrabold">
          Stocks bas {data.lowStockCount > data.lowStock.length && `(20 premiers sur ${data.lowStockCount})`}
        </h2>
        <ul className="mt-2 divide-y divide-asphalte/10 border border-asphalte/15 bg-white text-sm">
          {data.lowStock.map((row) => (
            <li
              key={`${row.productSlug}-${row.variantLabel}-${row.storeName}`}
              className="flex flex-wrap justify-between gap-2 p-2"
            >
              <span>
                {row.productName} ({row.variantLabel}) : {row.storeName}
              </span>
              <span className={row.available === 0 ? "font-semibold text-balise" : ""}>
                {row.available} disponible{row.available > 1 ? "s" : ""} (seuil {row.alertThreshold})
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
