import type { Metadata } from "next";
import { Suspense } from "react";
import type { GdprRequestDto } from "@lafoulee/shared";
import { adminGet } from "@/lib/admin-api";
import { ProcessRequestButton } from "./process-request-button";

export const metadata: Metadata = { title: "Demandes RGPD" };

const TYPES = { ACCESS: "Copie des données", DELETION: "Effacement" } as const;

/** Demandes des visiteurs sans compte, à traiter sous un mois (EA06). */
export default function GdprRequestsPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold uppercase">Demandes RGPD</h1>
      <p className="mt-2 text-asphalte/80">
        Délai légal : un mois. Une copie part par email en pièce jointe ; un effacement anonymise les commandes et
        efface l&apos;inscription à la newsletter.
      </p>
      <Suspense fallback={<p className="mt-4">Chargement...</p>}>
        <Requests />
      </Suspense>
    </>
  );
}

async function Requests() {
  const requests = await adminGet<GdprRequestDto[]>("/gdpr-requests");
  if (requests.length === 0) return <p className="mt-4">Aucune demande.</p>;
  return (
    <table className="mt-4 w-full border border-asphalte/15 bg-white text-left text-sm">
      <caption className="sr-only">Demandes</caption>
      <thead className="bg-craie">
        <tr>
          <th scope="col" className="p-2">
            Demande
          </th>
          <th scope="col" className="p-2">
            Email
          </th>
          <th scope="col" className="p-2">
            Échéance
          </th>
          <th scope="col" className="p-2">
            État
          </th>
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => {
          const late = request.overdue;
          return (
            <tr key={request.id} className="border-t border-asphalte/10">
              <td className="p-2">{TYPES[request.type]}</td>
              <td className="p-2">
                {request.email}
                {request.hasAccount && <span className="text-asphalte/70"> (compte)</span>}
              </td>
              <td className={`p-2 ${late ? "font-semibold text-balise" : ""}`}>
                {new Date(request.dueAt).toLocaleDateString("fr-FR")}
                {late && " (en retard)"}
              </td>
              <td className="p-2">
                {request.status === "DONE" ? (
                  `Traitée le ${new Date(request.closedAt!).toLocaleDateString("fr-FR")}`
                ) : (
                  <ProcessRequestButton id={request.id} type={request.type} />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
