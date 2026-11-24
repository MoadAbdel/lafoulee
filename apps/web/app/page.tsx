import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/catalog";

/**
 * Accueil, direction "affiche suisse" : une affiche rouge (le mot Courir et un
 * sprinteur), puis la grille des rayons en photos et un bandeau vers les boutiques.
 */
export default function HomePage() {
  return (
    <>
      <section data-affiche className="relative isolate -mt-px overflow-hidden bg-balise text-craie">
        <p
          aria-hidden="true"
          className="pointer-events-none absolute -left-[1.5vw] top-[calc(2vh+0.26em)] m-0 select-none text-[31vw] font-black leading-[0.78] tracking-[-0.075em] motion-safe:animate-[entree_0.9s_cubic-bezier(.2,.7,.2,1)_both]"
        >
          Courir
        </p>
        <Image
          src="/visuels/sprint.jpg"
          alt=""
          width={1600}
          height={1067}
          priority
          sizes="(min-width: 768px) 46vw, 90vw"
          className="absolute bottom-0 right-[4vw] -z-10 h-[72%] w-[90vw] object-cover object-[30%_50%] mix-blend-multiply contrast-125 md:h-[88%] md:w-[46vw]"
        />
        <div className="relative mx-auto grid min-h-[calc(100svh-7.5rem)] max-w-6xl grid-cols-12 items-end gap-4 px-4 pb-10 pt-[38vw] md:pt-[24vw]">
          <div className="col-span-12 md:col-span-6 motion-safe:animate-[entree_0.9s_0.2s_cubic-bezier(.2,.7,.2,1)_both]">
            <h1 className="max-w-[18ch] text-3xl font-bold leading-[1.04] tracking-tight sm:text-4xl">
              Chaussures et équipement de running, trois boutiques à Lyon
            </h1>
            <p className="mt-4 max-w-[44ch] text-lg leading-snug">
              Essai sur tapis et analyse de foulée en boutique. Commande en ligne, retrait gratuit.
            </p>
            <Link
              href="/produits?categorie=chaussures-route"
              className="mt-6 inline-flex min-h-12 items-center gap-3 bg-craie px-6 font-bold text-asphalte transition-transform hover:translate-x-1 active:scale-[0.97]"
            >
              Voir les chaussures <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="titre-rayons" className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid items-end gap-6 border-b-[3px] border-asphalte pb-6 md:grid-cols-12">
          <h2
            id="titre-rayons"
            className="font-display text-4xl font-extrabold leading-[0.98] tracking-tighter md:col-span-7 md:text-6xl"
          >
            Tout pour courir, de la route <span className="text-orange">au sentier</span>.
          </h2>
          <Suspense fallback={<p className="md:col-span-5">En stock dans nos trois boutiques lyonnaises.</p>}>
            <CatalogSummary />
          </Suspense>
        </div>
        <Suspense fallback={<div aria-busy="true" className="mt-4 h-[46rem] bg-papier" />}>
          <Departments />
        </Suspense>
      </section>
    </>
  );
}

async function CatalogSummary() {
  await connection(); // lu à la requête (puis mis en cache), jamais au build
  const { total } = await getProducts({ page: 1 });
  return (
    <p className="m-0 text-lg leading-snug md:col-span-5">
      {total} modèles en stock dans nos trois boutiques lyonnaises. Essai sur tapis, retrait gratuit.
    </p>
  );
}

/** Taille de chaque tuile dans la grille de 12 colonnes : deux grandes, puis quatre petites. */
const TILE = [
  "col-span-2 row-span-2 md:col-span-7",
  "col-span-2 row-span-2 md:col-span-5",
  "md:col-span-3",
  "md:col-span-3",
  "md:col-span-3",
  "md:col-span-3",
];

/** Un rayon par catégorie : la photo du premier modèle et le nombre de produits. */
async function Departments() {
  await connection();
  const categories = await getCategories();
  const lists = await Promise.all(categories.map((category) => getProducts({ page: 1, categorie: category.slug })));
  return (
    <>
      <ul className="mt-4 grid list-none grid-cols-2 auto-rows-[11rem] gap-3 p-0 md:grid-cols-12 md:gap-4 md:auto-rows-[13.5rem]">
        {categories.slice(0, TILE.length).map((category, index) => {
          const list = lists[index]!;
          const cover = list.items.find((item) => item.imageUrl) ?? list.items[0];
          return (
            <li key={category.slug} className={`relative ${TILE[index]}`}>
              <Link
                href={`/produits?categorie=${category.slug}`}
                className="group absolute inset-0 block overflow-hidden bg-papier"
              >
                {cover?.imageUrl && (
                  <Image
                    src={cover.imageUrl}
                    alt=""
                    fill
                    sizes={index < 2 ? "(min-width: 768px) 58vw, 100vw" : "(min-width: 768px) 25vw, 100vw"}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                )}
                <span className="absolute bottom-0 left-0 flex items-baseline gap-3 bg-craie py-2 pr-4">
                  <span className="border-b-4 border-orange text-lg font-extrabold leading-tight tracking-tighter sm:text-2xl md:text-3xl">
                    {category.name}
                  </span>
                  <span className="font-extrabold text-orange">
                    {list.total}
                    <span className="sr-only"> produits</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 bg-orange px-6 py-8 text-craie md:px-8">
        <p className="m-0 max-w-[30ch] text-2xl font-extrabold leading-tight tracking-tight md:text-3xl">
          Pas sûr de votre pointure ? Faites analyser votre foulée en boutique.
        </p>
        <Link
          href="/boutiques"
          className="inline-flex min-h-12 items-center gap-3 bg-craie px-6 font-bold text-asphalte"
        >
          Trouver ma boutique <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </>
  );
}
