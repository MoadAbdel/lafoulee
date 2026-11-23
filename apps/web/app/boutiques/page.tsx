import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { ConsentGate } from "@/components/consent-gate";
import { getStores } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Nos boutiques à Lyon",
  description: "Croix-Rousse, Part-Dieu, Gerland : adresses, horaires, retrait gratuit et analyse de foulée.",
  alternates: { canonical: "/boutiques" },
};

export default function StoresPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-5xl font-bold uppercase">Nos boutiques</h1>
      <p className="mt-2 max-w-2xl">
        Retrait gratuit de vos commandes, essayage et analyse de foulée par des vendeurs coureurs.
      </p>
      <Suspense fallback={<StoresSkeleton />}>
        <Stores />
      </Suspense>
    </div>
  );
}

/** Réserve la place des 3 boutiques (évite le décalage de la page à leur arrivée). */
function StoresSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Chargement des boutiques...
      </p>
      <ul aria-hidden="true" className="mt-8 space-y-10">
        {[0, 1, 2].map((index) => (
          <li key={index} className="grid gap-4 md:grid-cols-2">
            <div className="h-40 bg-asphalte/5" />
            <div className="aspect-video border border-asphalte/20 bg-craie" />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Stores() {
  await connection(); // lu à la requête (puis mis en cache), jamais au build
  const stores = await getStores();
  return (
    <ul className="mt-8 space-y-10">
      {stores.map((store) => {
        const address = `${store.address}, ${store.postalCode} ${store.city}`;
        // Données structurées LocalBusiness (référencement local, dossier C20).
        const jsonLd = {
          "@context": "https://schema.org",
          "@type": "SportingGoodsStore",
          name: store.name,
          address: {
            "@type": "PostalAddress",
            streetAddress: store.address,
            postalCode: store.postalCode,
            addressLocality: store.city,
            addressCountry: "FR",
          },
          openingHours: store.openingHours,
        };
        return (
          <li key={store.slug} id={store.slug} className="grid gap-4 md:grid-cols-2">
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
            />
            <div>
              <h2 className="font-display text-3xl font-bold uppercase">{store.name}</h2>
              <p className="mt-2">{address}</p>
              <p className="text-asphalte/80">{store.openingHours}</p>
              <a
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`}
                className="mt-3 inline-block underline underline-offset-4"
              >
                Voir l&apos;adresse sur une carte (OpenStreetMap, sans cookie)
              </a>
            </div>
            <ConsentGate
              fallback={
                <p>La carte Google Maps dépose des cookies : elle ne s&apos;affiche qu&apos;avec votre accord.</p>
              }
            >
              <iframe
                title={`Carte : ${store.name}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-video w-full border-0"
              />
            </ConsentGate>
          </li>
        );
      })}
    </ul>
  );
}
