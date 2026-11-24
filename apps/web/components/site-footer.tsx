import Link from "next/link";
import { ManageConsentButton } from "./consent-banner";
import { NewsletterForm } from "./newsletter-form";

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-asphalte text-craie">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display tracking-tight text-2xl font-extrabold">La Foulée</p>
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
              <Link href="/boutiques" className="underline-offset-4 hover:underline">
                Nos boutiques
              </Link>
            </li>
            <li>
              <Link href="/compte" className="underline-offset-4 hover:underline">
                Mon compte
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Légal">
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/confidentialite" className="underline-offset-4 hover:underline">
                Politique de confidentialité
              </Link>
            </li>
            <li>
              <Link href="/mentions-legales" className="underline-offset-4 hover:underline">
                Mentions légales
              </Link>
            </li>
            <li>
              <ManageConsentButton />
            </li>
          </ul>
        </nav>
        <NewsletterForm />
      </div>
      <p className="border-t border-craie/15 px-4 py-3 text-center text-xs text-craie/70">
        Projet de démonstration : enseigne fictive, aucune vente réelle.
      </p>
    </footer>
  );
}
