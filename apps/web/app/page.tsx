import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { formatPrice } from "@lafoulee/shared";
import { ProductVisual } from "@/components/product-visual";
import { getProducts, getStores } from "@/lib/catalog";

/**
 * Accueil, direction "affiche suisse" : une affiche rouge (le mot Courir et un
 * sprinteur), les modèles du moment en tableau numéroté, puis les trois boutiques.
 */
export default function HomePage() {
  return (
    <>
      <section data-affiche className="relative isolate -mt-px overflow-hidden bg-balise text-craie">
        <p
          aria-hidden="true"
          className="pointer-events-none absolute -left-[1.5vw] top-[2vh] m-0 select-none text-[31vw] font-black leading-[0.78] tracking-[-0.075em] motion-safe:animate-[entree_0.9s_cubic-bezier(.2,.7,.2,1)_both]"
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
          <dl className="col-span-12 flex gap-8 md:col-span-6 md:justify-end">
            <div>
              <dt className="sr-only">Boutiques</dt>
              <dd className="m-0 text-5xl font-extrabold leading-none tracking-tighter">3</dd>
              <dd className="m-0 font-semibold" aria-hidden="true">
                boutiques
              </dd>
            </div>
            <div>
              <dt className="sr-only">Retrait en boutique</dt>
              <dd className="m-0 text-5xl font-extrabold leading-none tracking-tighter">0&nbsp;€</dd>
              <dd className="m-0 font-semibold" aria-hidden="true">
                retrait
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section aria-labelledby="titre-modeles" className="mx-auto max-w-6xl px-4 py-24">
        <div className="grid gap-4 border-t-[3px] border-asphalte pt-4 md:grid-cols-12">
          <h2
            id="titre-modeles"
            className="font-display text-5xl font-extrabold leading-[0.92] tracking-tighter md:col-span-8 md:text-7xl"
          >
            Les modèles du moment
          </h2>
          <p className="self-end md:col-span-4">
            Les dernières paires arrivées en boutique.{" "}
            <Link href="/produits?tri=nouveautes" className="font-semibold underline underline-offset-4">
              Tout le catalogue
            </Link>
          </p>
        </div>
        <Suspense fallback={<ModelsSkeleton />}>
          <LatestModels />
        </Suspense>
      </section>

      <section aria-labelledby="titre-boutiques" className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2
            id="titre-boutiques"
            className="font-display text-5xl font-extrabold leading-[0.92] tracking-tighter md:text-7xl"
          >
            Trois boutiques
          </h2>
          <p className="max-w-[34ch]">Retrait gratuit, essai et analyse de foulée.</p>
        </div>
        <Suspense fallback={<div className="h-96 border-t-[3px] border-asphalte" aria-busy="true" />}>
          <StoreList />
        </Suspense>
      </section>
    </>
  );
}

const pad = (index: number) => String(index + 1).padStart(2, "0");

async function LatestModels() {
  await connection(); // lu à la requête (puis mis en cache), jamais au build
  const { items } = await getProducts({ page: 1, tri: "nouveautes" });
  return (
    <ol className="mt-8 list-none border-t-[3px] border-asphalte p-0">
      {items.slice(0, 5).map((product, index) => (
        <li
          key={product.slug}
          className="group relative grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-asphalte/20 py-3 transition-colors hover:bg-papier md:grid-cols-[5rem_8rem_1fr_1fr_auto]"
        >
          <span aria-hidden="true" className="text-4xl font-extrabold tracking-tighter text-balise">
            {pad(index)}
          </span>
          <div className="hidden w-32 overflow-hidden md:block">
            <ProductVisual
              brand={product.brand}
              name={product.name}
              imageUrl={product.imageUrl}
              imageAlt={product.imageAlt}
              compact
            />
          </div>
          <h3 className="m-0 text-xl font-bold leading-tight tracking-tight">
            <Link href={`/produits/${product.slug}`} className="after:absolute after:inset-0">
              {product.name}
            </Link>
            <span className="block text-sm font-medium tracking-normal text-asphalte/70">{product.brand}</span>
          </h3>
          <p className="m-0 hidden text-asphalte/80 md:block">{product.shortDescription}</p>
          <p className="m-0 text-right text-xl font-extrabold tracking-tight">
            {product.inStock ? (
              <>
                <span className="sr-only">Prix : à partir de </span>
                {formatPrice(product.fromPriceCents)}
              </>
            ) : (
              <span className="text-base font-semibold text-asphalte/70">Rupture</span>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

function ModelsSkeleton() {
  return (
    <div aria-busy="true" className="mt-8 border-t-[3px] border-asphalte">
      <p className="sr-only" role="status">
        Chargement des modèles...
      </p>
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-[6.25rem] border-b border-asphalte/20" />
      ))}
    </div>
  );
}

async function StoreList() {
  await connection();
  const stores = await getStores();
  return (
    <ul className="list-none border-t-[3px] border-asphalte p-0">
      {stores.map((store) => (
        <li key={store.slug} className="border-b border-asphalte/20">
          <Link
            href={`/boutiques#${store.slug}`}
            className="group grid items-baseline gap-2 py-5 md:grid-cols-[1fr_22rem] md:gap-6"
          >
            <span className="text-5xl font-extrabold leading-[0.9] tracking-tighter transition-colors group-hover:text-balise md:text-8xl">
              {store.name.replace(/^La Foulée\s*/, "")}
            </span>
            <span className="text-asphalte/80">
              {store.address}, {store.city}. {store.openingHours}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
