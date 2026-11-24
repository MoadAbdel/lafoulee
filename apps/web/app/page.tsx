import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CatalogSummary, Departments } from "@/components/home-departments";

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
