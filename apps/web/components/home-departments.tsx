import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { getCategories, getProducts } from "@/lib/catalog";

export async function CatalogSummary() {
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
export async function Departments() {
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
                  </span>{" "}
                  <span className="font-extrabold text-orange">
                    {`${list.total} `}
                    <span className="sr-only">produits</span>
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
