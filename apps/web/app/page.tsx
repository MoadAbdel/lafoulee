import { Suspense } from "react";
import { ApiStatus } from "./_components/api-status";

/**
 * Page d'accueil provisoire (étape 1 : socle). Elle prouve que le front,
 * l'API et le routage Vercel fonctionnent ensemble.
 */
export default function Home() {
  return (
    <main id="contenu" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="font-display text-sm font-semibold uppercase tracking-widest text-foret">
        Course à pied et trail, Lyon
      </p>
      <h1 className="font-display text-5xl font-bold uppercase leading-none sm:text-7xl">La Foulée</h1>
      <p className="max-w-prose text-lg">
        La boutique en ligne arrive bientôt : chaussures, textile et nutrition, avec retrait gratuit dans nos trois
        boutiques.
      </p>
      <Suspense fallback={<p className="text-sm">Vérification de l&apos;API...</p>}>
        <ApiStatus />
      </Suspense>
    </main>
  );
}
