import Link from "next/link";
import { MAIN_NAV } from "@/lib/nav";

/** En-tête statique : logo, recherche (formulaire GET, fonctionne sans JavaScript), navigation. */
export function SiteHeader() {
  return (
    <header className="border-b border-asphalte/15 bg-craie">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="font-display text-3xl font-bold uppercase leading-none tracking-tight">
          La Foulée
        </Link>
        <form action="/produits" role="search" className="order-last flex w-full sm:order-none sm:ml-auto sm:w-auto">
          <label htmlFor="recherche" className="sr-only">
            Rechercher un produit
          </label>
          <input
            id="recherche"
            name="q"
            type="search"
            placeholder="Chaussure, gel, frontale..."
            maxLength={80}
            className="min-h-11 w-full border border-asphalte/40 bg-white px-3 sm:w-64"
          />
          <button type="submit" className="min-h-11 bg-asphalte px-4 font-semibold text-craie">
            Rechercher
          </button>
        </form>
        <Link
          href="/compte"
          className="ml-auto min-h-11 content-center font-semibold underline-offset-4 hover:underline sm:ml-0"
        >
          Mon compte
        </Link>
      </div>
      <nav aria-label="Catégories" className="border-t border-asphalte/10">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
          {MAIN_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block min-h-11 content-center whitespace-nowrap px-3 font-display text-lg font-semibold uppercase tracking-wide hover:text-balise"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
