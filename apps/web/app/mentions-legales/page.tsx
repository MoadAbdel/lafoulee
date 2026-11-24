import type { Metadata } from "next";
import Link from "next/link";
import photoCreditsData from "@/lib/photo-credits.json";

interface PhotoCredit {
  product: string;
  author: string;
  licence: string;
  licenceUrl: string;
  source: string;
}

/** Crédits des photos produits (Wikimedia Commons), générés avec le catalogue. */
const photoCredits = photoCreditsData as PhotoCredit[];

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-display tracking-tight text-5xl font-extrabold">Mentions légales</h1>
      <p className="border-l-4 border-balise bg-white p-3">
        Site de démonstration réalisé dans le cadre d&apos;une certification de développeur. La Foulée est une enseigne
        fictive : aucune commande n&apos;est expédiée et les paiements se font en mode test.
      </p>
      <section>
        <h2 className="font-display tracking-tight text-3xl font-extrabold">Éditeur</h2>
        <p>La Foulée (fictive), 42 rue d&apos;Austerlitz, 69004 Lyon.</p>
      </section>
      <section>
        <h2 className="font-display tracking-tight text-3xl font-extrabold">Hébergement</h2>
        <p>Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis. Fonctions exécutées à Francfort.</p>
      </section>
      <section>
        <h2 className="font-display tracking-tight text-3xl font-extrabold">Données personnelles</h2>
        <p>
          Voir la{" "}
          <Link href="/confidentialite" className="underline underline-offset-4">
            politique de confidentialité
          </Link>
          .
        </p>
      </section>
      <section>
        <h2 className="font-display tracking-tight text-3xl font-extrabold">Crédits photos</h2>
        <p>
          Photographies sous licence libre, issues de Wikimedia Commons et reproduites dans le respect de leur licence
          (citation de l&apos;auteur et de la licence) :
        </p>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Page d&apos;accueil, sprinteur au départ : ThoroughlyReviewed,{" "}
            <a
              href="https://creativecommons.org/licenses/by/2.0/deed.fr"
              className="underline underline-offset-4"
              rel="license noopener"
            >
              CC BY 2.0
            </a>
            , passée en noir et blanc et fondue dans le rouge de l&apos;affiche.
          </li>
          {photoCredits.map((credit) => (
            <li key={credit.source}>
              {credit.product} :{" "}
              <a href={credit.source} className="underline underline-offset-4" rel="noopener">
                {credit.author}
              </a>
              ,{" "}
              <a href={credit.licenceUrl} className="underline underline-offset-4" rel="license noopener">
                {credit.licence}
              </a>
              .
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
