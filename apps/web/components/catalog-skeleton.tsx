import { PAGE_SIZE } from "@lafoulee/shared";

/**
 * Attente du catalogue : réserve la place du titre, des filtres et de la grille
 * pour que l'arrivée des produits ne décale pas la page (CLS, Core Web Vitals).
 */
export function CatalogSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Chargement du catalogue...
      </p>
      <div aria-hidden="true">
        <div className="h-10 w-2/3 max-w-md bg-asphalte/10 sm:h-12" />
        <div className="mt-6 h-11 w-full max-w-3xl bg-asphalte/5" />
        <div className="mt-6 h-5 w-24 bg-asphalte/5" />
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }, (_, index) => (
            <li key={index} className="border border-asphalte/15 bg-white">
              <div className="aspect-[4/3] bg-craie" />
              <div className="h-32 p-4" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
