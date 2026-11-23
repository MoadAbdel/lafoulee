import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Mentions légales" };

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 leading-relaxed">
      <h1 className="font-display text-5xl font-bold uppercase">Mentions légales</h1>
      <p className="border-l-4 border-balise bg-white p-3">
        Site de démonstration réalisé dans le cadre d&apos;une certification de développeur. La Foulée est une enseigne
        fictive : aucune commande n&apos;est expédiée et les paiements se font en mode test.
      </p>
      <section>
        <h2 className="font-display text-3xl font-bold uppercase">Éditeur</h2>
        <p>La Foulée (fictive), 42 rue d&apos;Austerlitz, 69004 Lyon.</p>
      </section>
      <section>
        <h2 className="font-display text-3xl font-bold uppercase">Hébergement</h2>
        <p>Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis. Fonctions exécutées à Francfort.</p>
      </section>
      <section>
        <h2 className="font-display text-3xl font-bold uppercase">Données personnelles</h2>
        <p>
          Voir la{" "}
          <Link href="/confidentialite" className="underline underline-offset-4">
            politique de confidentialité
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
