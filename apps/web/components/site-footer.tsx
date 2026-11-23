import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-asphalte text-craie">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-bold uppercase">La Foulée</p>
          <p className="mt-2 text-sm text-craie/80">
            Boutiques de course à pied à Lyon : Croix-Rousse, Part-Dieu et Gerland. Retrait gratuit en boutique.
          </p>
        </div>
        <nav aria-label="Informations">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/produits" className="underline-offset-4 hover:underline">
                Tout le catalogue
              </Link>
            </li>
            <li>
              <Link href="/compte" className="underline-offset-4 hover:underline">
                Mon compte
              </Link>
            </li>
          </ul>
        </nav>
        <p className="text-sm text-craie/70">Projet de démonstration : enseigne fictive, aucune vente réelle.</p>
      </div>
    </footer>
  );
}
