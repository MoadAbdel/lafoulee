import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { AdminListDto, AuditEntryDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";

export const metadata: Metadata = { title: "Journal d'audit" };

const ACTIONS: Record<string, string> = {
  "admin.login": "Connexion administrateur",
  "order.status": "Changement de statut de commande",
  "order.refund": "Remboursement",
  "product.create": "Création de produit",
  "product.update": "Modification de produit",
  "product.image.add": "Ajout de photo",
  "product.image.delete": "Suppression de photo",
  "variant.create": "Ajout de taille",
  "category.create": "Création de catégorie",
  "category.update": "Modification de catégorie",
  "category.delete": "Suppression de catégorie",
  "stock.update": "Modification de stock",
  "api-key.create": "Création de clé API",
  "api-key.revoke": "Révocation de clé API",
};

export default function AuditPage({ searchParams }: PageProps<"/admin/journal">) {
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Journal d&apos;audit</h1>
      <p className="mt-2 text-asphalte/80">Chaque action d&apos;un administrateur, conservée un an.</p>
      <Suspense fallback={<p className="mt-4">Chargement du journal...</p>}>
        <Journal searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Journal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).page;
  const page = Math.min(1000, Math.max(1, Number(Array.isArray(raw) ? raw[0] : raw) || 1));
  const list = await adminGet<AdminListDto<AuditEntryDto>>(`/audit?page=${page}`);
  return (
    <div className="mt-4 space-y-4">
      <table className="w-full border border-asphalte/15 bg-white text-left text-sm">
        <caption className="sr-only">Actions des administrateurs</caption>
        <thead className="bg-craie">
          <tr>
            <th scope="col" className="p-2">
              Date
            </th>
            <th scope="col" className="p-2">
              Administrateur
            </th>
            <th scope="col" className="p-2">
              Action
            </th>
            <th scope="col" className="p-2">
              Objet
            </th>
            <th scope="col" className="p-2">
              IP
            </th>
          </tr>
        </thead>
        <tbody>
          {list.items.map((entry) => (
            <tr key={entry.id} className="border-t border-asphalte/10">
              <td className="p-2 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString("fr-FR")}</td>
              <td className="p-2">{entry.actorEmail ?? "Compte supprimé"}</td>
              <td className="p-2">{ACTIONS[entry.action] ?? entry.action}</td>
              <td className="p-2">
                {entry.entity}
                {entry.entityId && <code className="ml-1 text-xs text-asphalte/70">{entry.entityId.slice(0, 8)}</code>}
              </td>
              <td className="p-2">{entry.ip}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-4">
          {page > 1 && (
            <Link href={`/admin/journal?page=${page - 1}`} className="underline underline-offset-4">
              Plus récent
            </Link>
          )}
          <span>
            Page {page} sur {list.totalPages}
          </span>
          {page < list.totalPages && (
            <Link href={`/admin/journal?page=${page + 1}`} className="underline underline-offset-4">
              Plus ancien
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
