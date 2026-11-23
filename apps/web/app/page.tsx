import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ProductCard } from "@/components/product-card";
import { getProducts } from "@/lib/catalog";
import { MAIN_NAV } from "@/lib/nav";

export default function HomePage() {
  return (
    <>
      <section className="bg-asphalte text-craie">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="font-display text-lg font-semibold uppercase tracking-widest text-balise-clair">
            Course à pied et trail, Lyon
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-5xl font-bold uppercase leading-none sm:text-7xl">
            Essayez en boutique, courez dès ce soir
          </h1>
          <p className="mt-6 max-w-xl text-lg text-craie/85">
            Choisissez votre modèle et votre pointure en ligne, nous le gardons dans la boutique de votre choix. Retrait
            gratuit, conseil de coureurs.
          </p>
          <Link
            href="/produits?categorie=chaussures-trail"
            className="mt-8 inline-block min-h-11 bg-balise px-6 py-3 font-semibold text-craie hover:bg-balise/90"
          >
            Voir les chaussures de trail
          </Link>
        </div>
      </section>

      <section aria-labelledby="titre-categories" className="mx-auto max-w-6xl px-4 py-12">
        <h2 id="titre-categories" className="font-display text-3xl font-bold uppercase">
          Par univers
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MAIN_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block border border-asphalte/20 bg-white px-4 py-6 font-display text-2xl font-semibold uppercase hover:border-balise hover:text-balise"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titre-nouveautes" className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="titre-nouveautes" className="font-display text-3xl font-bold uppercase">
            Nouveautés
          </h2>
          <Link href="/produits?tri=nouveautes" className="font-semibold underline underline-offset-4">
            Tout voir
          </Link>
        </div>
        <Suspense fallback={<p className="mt-6">Chargement des nouveautés...</p>}>
          <LatestProducts />
        </Suspense>
      </section>
    </>
  );
}

async function LatestProducts() {
  await connection(); // données lues à la requête (puis mises en cache), pas au build
  const { items } = await getProducts({ page: 1, tri: "nouveautes" });
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.slice(0, 6).map((product) => (
        <li key={product.slug}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
