"use client";

/** Erreur dans le back-office (accès refusé par l'API, API indisponible) : message simple, sans détail technique. */
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="border-l-4 border-balise bg-white p-4">
      <p className="font-semibold">Impossible d&apos;afficher cette page.</p>
      <p className="mt-1 text-sm">Vérifiez que vous êtes connecté avec un compte administrateur, puis réessayez.</p>
      <button type="button" onClick={reset} className="mt-3 min-h-11 border border-asphalte px-4 font-semibold">
        Réessayer
      </button>
    </div>
  );
}
