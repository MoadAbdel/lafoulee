import Link from "next/link";
import { MAIN_NAV } from "@/lib/nav";
import { AccountLink } from "./account-link";
import { CartBadge } from "./cart-badge";

/** En-tête statique : logo, recherche (formulaire GET, fonctionne sans JavaScript), navigation. */
export function SiteHeader() {
  return (
    <header className="site-header border-b-[3px] border-asphalte bg-craie">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="font-display text-3xl font-extrabold leading-none tracking-tight">
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
        <div className="ml-auto flex items-center gap-5 sm:ml-0">
          <AccountLink />
          <CartBadge />
        </div>
      </div>
      <nav aria-label="Catégories" className="border-t border-current/15">
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
          {MAIN_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block min-h-11 content-center whitespace-nowrap px-3 font-display tracking-tight text-lg font-bold hover:underline hover:decoration-2 hover:underline-offset-8"
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
