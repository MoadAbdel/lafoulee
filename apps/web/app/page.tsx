import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "@lafoulee/shared";
import { CatalogSummary, Departments } from "@/components/home-departments";

/**
 * Accueil, direction "affiche suisse" : une affiche rouge (le mot Essayez, l'atout des
 * boutiques, et un sprinteur), puis la grille des rayons en photos et un bandeau vers les boutiques.
 */
export default function HomePage() {
  return (
    <>
      <section
        data-affiche
        className="relative isolate -mt-px flex flex-col overflow-hidden bg-balise text-craie md:min-h-[calc(100svh-7.5rem)]"
      >
        {/* Le grand mot est dans le flux : sa taille dépend de la largeur ET de la hauteur de
            l'écran, donc il ne recouvre jamais le texte (écrans larges et peu hauts compris). */}
        <p
          aria-hidden="true"
          className="pointer-events-none -ml-[1.5vw] mb-0 mt-0 select-none whitespace-nowrap pt-[0.2em] text-[min(25.5vw,44svh)] font-black leading-[0.78] tracking-[-0.075em] motion-safe:animate-[entree_0.9s_cubic-bezier(.2,.7,.2,1)_both]"
        >
          Essayez
        </p>
        <Image
          src="/visuels/sprint.jpg"
          alt=""
          width={1600}
          height={1067}
          priority
          sizes="(min-width: 768px) 46vw, 90vw"
          className="-z-10 -mt-[4vw] h-[36svh] w-full object-cover object-[30%_45%] mix-blend-multiply contrast-125 md:absolute md:bottom-0 md:right-[4vw] md:mt-0 md:h-[88%] md:w-[46vw]"
        />
        <div className="relative mx-auto mt-auto w-full max-w-6xl px-4 pb-10 pt-6">
          <div className="md:max-w-[50%] motion-safe:animate-[entree_0.9s_0.2s_cubic-bezier(.2,.7,.2,1)_both]">
            <h1 className="max-w-[20ch] text-3xl font-bold leading-[1.04] tracking-tight sm:text-4xl">
              Votre prochaine paire, essayée sur tapis avant de l&apos;acheter.
            </h1>
            <p className="mt-4 max-w-[44ch] text-lg leading-snug">
              Un vendeur coureur regarde votre foulée et vous fait essayer les modèles qui vous vont. Dans nos 3
              boutiques de Lyon.
            </p>
            <Link
              href="/produits?categorie=chaussures-route"
              className="mt-6 inline-flex min-h-12 items-center gap-3 bg-craie px-6 font-bold text-asphalte transition-transform hover:translate-x-1 active:scale-[0.97]"
            >
              Voir les chaussures de route <span aria-hidden="true">&rarr;</span>
            </Link>
            <p className="mt-3 text-[0.95rem]">
              Ou commandez en ligne : retrait gratuit, livraison offerte dès {FREE_SHIPPING_THRESHOLD_CENTS / 100}
              &nbsp;€.
            </p>
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
