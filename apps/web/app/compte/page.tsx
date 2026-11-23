import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import { LogoutButton } from "./logout-button";
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
      <h1 className="font-display text-4xl font-bold uppercase">Bonjour{user.firstName ? ` ${user.firstName}` : ""}</h1>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border border-asphalte/15 bg-white p-4">
        <dt className="font-semibold">Email</dt>
        <dd>{user.email}</dd>
        <dt className="font-semibold">Profil</dt>
        <dd>{user.role === "ADMIN" ? "Administrateur" : "Client"}</dd>
      </dl>
      <p className="mt-6 text-asphalte/80">L&apos;historique de vos commandes apparaîtra ici.</p>
      <div className="mt-8 max-w-xs">
        <LogoutButton />
      </div>
    </>
  );
}
