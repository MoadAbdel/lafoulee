import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { RefreshSession } from "../compte/refresh-session";

export const metadata: Metadata = {
  title: { default: "Back-office", template: "%s | Back-office La Foulée" },
  robots: { index: false },
};

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/produits", label: "Produits et stocks" },
  { href: "/admin/categories", label: "Catégories" },
  { href: "/admin/rgpd", label: "Demandes RGPD" },
  { href: "/admin/cles-api", label: "Clés API" },
  { href: "/admin/journal", label: "Journal d'audit" },
];

/** Back-office : réservé au rôle ADMIN (session ouverte avec la double authentification). */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <nav aria-label="Back-office" className="lg:w-56 lg:shrink-0">
        <p className="font-display tracking-tight text-xl font-extrabold">Back-office</p>
        <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block min-h-11 content-center border border-asphalte/20 bg-white px-3 hover:border-balise"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">
        <Suspense fallback={<p>Chargement...</p>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </div>
  );
}

async function AdminGate({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.status === "anonymous") redirect("/connexion");
  if (session.status === "expired") return <RefreshSession />;
  if (session.user.role !== "ADMIN") {
    return <p role="alert">Accès réservé aux administrateurs.</p>;
  }
  return <>{children}</>;
}
